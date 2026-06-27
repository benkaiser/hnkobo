'use strict';

const db = require('./db');
const config = require('./config');
const algolia = require('./algolia');
const extractor = require('./extractor');

let running = false;

function nowI() {
  return Math.floor(Date.now() / 1000);
}

// Reduce the Algolia comment tree to the fields we render, recursively.
function shapeComments(children) {
  if (!Array.isArray(children)) return [];
  return children
    .filter((c) => c && c.type === 'comment')
    .map((c) => ({
      id: c.id,
      author: c.author || null, // null => deleted/dead
      created_at_i: c.created_at_i || null,
      text: c.text || null, // null => deleted/dead
      children: shapeComments(c.children),
    }));
}

const upsertStory = db.prepare(`
INSERT INTO stories
  (id, title, url, author, points, num_comments, story_text,
   created_at_i, first_seen_i, last_seen_i)
VALUES
  (@id, @title, @url, @author, @points, @num_comments, @story_text,
   @created_at_i, @now, @now)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  url = excluded.url,
  author = excluded.author,
  points = excluded.points,
  num_comments = excluded.num_comments,
  story_text = excluded.story_text,
  last_seen_i = excluded.last_seen_i
`);

const setComments = db.prepare(`
UPDATE stories SET comments_json = ?, comments_updated_i = ? WHERE id = ?
`);

const setArticle = db.prepare(`
UPDATE stories SET
  article_status = @status,
  article_title = @title,
  article_byline = @byline,
  article_html = @html,
  article_scraped_i = @scraped
WHERE id = @id
`);

const getArticleStatus = db.prepare('SELECT article_status, url FROM stories WHERE id = ?');
const purgeOld = db.prepare('DELETE FROM stories WHERE created_at_i < ?');

// Simple concurrency-limited map.
async function pool(items, concurrency, worker) {
  const queue = items.slice();
  const runners = [];
  for (let i = 0; i < Math.max(1, concurrency); i++) {
    runners.push((async () => {
      while (queue.length) {
        const item = queue.shift();
        try {
          await worker(item);
        } catch (err) {
          console.error('[scrape] worker error:', err.message);
        }
      }
    })());
  }
  await Promise.all(runners);
}

async function processStory(story) {
  const now = nowI();
  upsertStory.run({ ...story, now });

  // Re-cache comments every run.
  try {
    const item = await algolia.fetchItem(story.id);
    const comments = shapeComments(item.children);
    setComments.run(JSON.stringify(comments), now, story.id);
  } catch (err) {
    console.error(`[scrape] comments failed for ${story.id}: ${err.message}`);
  }

  // Article: scrape once. Permanent fail on first failure. Never re-fetch once decided.
  const row = getArticleStatus.get(story.id);
  if (row && row.article_status === 'pending') {
    if (!story.url) {
      // Ask/Show/text post: the "article" is the HN post text itself.
      setArticle.run({
        id: story.id,
        status: story.story_text ? 'ok' : 'none',
        title: story.title,
        byline: story.author,
        html: story.story_text || null,
        scraped: now,
      });
    } else {
      const result = await extractor.extract(story.url, {
        timeoutMs: config.articleTimeoutMs,
      });
      if (result.status === 'ok') {
        setArticle.run({
          id: story.id,
          status: 'ok',
          title: result.title || story.title,
          byline: result.byline || null,
          html: result.html,
          scraped: now,
        });
      } else {
        setArticle.run({
          id: story.id,
          status: 'failed',
          title: story.title,
          byline: null,
          html: null,
          scraped: now,
        });
        console.warn(`[scrape] extract failed ${story.id} (${story.url}): ${result.reason}`);
      }
    }
  }
}

async function runScrape() {
  if (running) {
    console.warn('[scrape] previous run still in progress; skipping');
    return { skipped: true };
  }
  running = true;
  const started = Date.now();
  try {
    console.log(`[scrape] start (points>${config.pointsThreshold}, limit ${config.storyLimit})`);
    const stories = await algolia.fetchTopStories(config.pointsThreshold, config.storyLimit);
    console.log(`[scrape] fetched ${stories.length} stories from list`);

    await pool(stories, config.articleConcurrency, processStory);

    const cutoff = nowI() - config.retentionDays * 86400;
    const purged = purgeOld.run(cutoff);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[scrape] done in ${elapsed}s; processed ${stories.length}, purged ${purged.changes}`);
    return { processed: stories.length, purged: purged.changes };
  } catch (err) {
    console.error('[scrape] run failed:', err.message);
    return { error: err.message };
  } finally {
    running = false;
  }
}

module.exports = { runScrape };
