'use strict';

const express = require('express');
const path = require('path');
const db = require('./db');
const config = require('./config');
const { runScrape } = require('./scraper');
const { escapeHtml, sanitizeHnHtml, timeAgo, hostOf, layout } = require('./render');

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(config.root, 'public')));

// ---- prepared statements ----
const listStories = db.prepare(`
SELECT id, title, url, author, points, num_comments, created_at_i,
       article_status, read_at_i
FROM stories
ORDER BY created_at_i DESC
`);

const getStory = db.prepare('SELECT * FROM stories WHERE id = ?');
const markRead = db.prepare('UPDATE stories SET read_at_i = COALESCE(read_at_i, ?) WHERE id = ?');

// ---- front page ----
app.get('/', (req, res) => {
  const stories = listStories.all();
  const items = stories.map((s) => {
    const host = hostOf(s.url);
    const articleAvailable = s.article_status === 'ok';
    const articleBtn = articleAvailable
      ? `<a class="btn" href="/article/${s.id}">Article</a>`
      : `<span class="btn btn-off">No&nbsp;article</span>`;
    const directBtn = s.url
      ? `<a class="btn" href="${escapeHtml(s.url)}" rel="noreferrer">Direct&nbsp;link</a>`
      : `<span class="btn btn-off">No&nbsp;link</span>`;
    return `
<li class="story${s.read_at_i ? ' read' : ''}">
  <div class="story-head">
    <span class="title">${escapeHtml(s.title)}</span>
    ${host ? `<span class="host">(${escapeHtml(host)})</span>` : ''}
  </div>
  <div class="meta">${s.points} points &middot; ${s.num_comments} comments &middot; ${escapeHtml(s.author || '')} &middot; ${timeAgo(s.created_at_i)}</div>
  <div class="btnrow">
    <a class="btn" href="/item/${s.id}">Comments</a>
    ${articleBtn}
    ${directBtn}
  </div>
</li>`;
  }).join('\n');

  const body = stories.length
    ? `<ul class="stories">${items}</ul>`
    : `<p class="empty">No stories cached yet. The scraper runs on startup and hourly.</p>`;

  res.send(layout('HN Kobo', body));
});

// ---- comment helpers ----
function renderComment(c, depth) {
  const collapsedDefault = depth >= 2; // top level + first reply level expanded
  const hasKids = c.children && c.children.length;
  const author = c.author
    ? escapeHtml(c.author)
    : '<span class="dead">[deleted]</span>';
  const text = c.text
    ? sanitizeHnHtml(c.text)
    : '<span class="dead">[deleted]</span>';

  const kids = hasKids
    ? `<div class="kids${collapsedDefault ? ' collapsed' : ''}">${c.children.map((k) => renderComment(k, depth + 1)).join('')}</div>`
    : '';

  const toggle = hasKids
    ? `<button class="toggle" type="button" aria-expanded="${collapsedDefault ? 'false' : 'true'}">${collapsedDefault ? `+ ${countTree(c.children)} replies` : '–'}</button>`
    : '';

  return `
<div class="comment" data-depth="${depth}">
  <div class="cmeta">${author} &middot; ${timeAgo(c.created_at_i)} ${toggle}</div>
  <div class="ctext">${text}</div>
  ${kids}
</div>`;
}

function countTree(children) {
  if (!children || !children.length) return 0;
  let n = children.length;
  for (const c of children) n += countTree(c.children);
  return n;
}

// ---- comments page ----
app.get('/item/:id', (req, res) => {
  const id = Number(req.params.id);
  const story = getStory.get(id);
  if (!story) return res.status(404).send(layout('Not found', '<p>Story not cached.</p>'));

  markRead.run(Math.floor(Date.now() / 1000), id);

  let comments = [];
  try {
    comments = JSON.parse(story.comments_json || '[]');
  } catch { comments = []; }

  const host = hostOf(story.url);
  const articleBtn = story.article_status === 'ok'
    ? `<a class="btn" href="/article/${id}">Article</a>`
    : `<span class="btn btn-off">No&nbsp;article</span>`;
  const directBtn = story.url
    ? `<a class="btn" href="${escapeHtml(story.url)}" rel="noreferrer">Direct&nbsp;link</a>`
    : '';

  const storyText = story.story_text
    ? `<div class="storytext">${sanitizeHnHtml(story.story_text)}</div>`
    : '';

  const tree = comments.length
    ? comments.map((c) => renderComment(c, 0)).join('')
    : '<p class="empty">No comments.</p>';

  const body = `
<article class="commentpage">
  <h1>${escapeHtml(story.title)} ${host ? `<span class="host">(${escapeHtml(host)})</span>` : ''}</h1>
  <div class="meta">${story.points} points &middot; ${story.num_comments} comments &middot; ${escapeHtml(story.author || '')} &middot; ${timeAgo(story.created_at_i)}</div>
  <div class="btnrow">${articleBtn} ${directBtn}</div>
  ${storyText}
  <div class="comments">${tree}</div>
</article>`;

  res.send(layout(story.title, body));
});

// ---- article page ----
app.get('/article/:id', (req, res) => {
  const id = Number(req.params.id);
  const story = getStory.get(id);
  if (!story) return res.status(404).send(layout('Not found', '<p>Story not cached.</p>'));

  markRead.run(Math.floor(Date.now() / 1000), id);

  const host = hostOf(story.url);
  const directBtn = story.url
    ? `<a class="btn" href="${escapeHtml(story.url)}" rel="noreferrer">Direct&nbsp;link</a>`
    : '';
  const commentsBtn = `<a class="btn" href="/item/${id}">Comments</a>`;

  let body;
  if (story.article_status === 'ok' && story.article_html) {
    body = `
<article class="articlepage">
  <h1>${escapeHtml(story.article_title || story.title)}</h1>
  ${story.article_byline ? `<div class="byline">${escapeHtml(story.article_byline)}</div>` : ''}
  ${host ? `<div class="meta">${escapeHtml(host)} &middot; ${timeAgo(story.created_at_i)}</div>` : ''}
  <div class="btnrow">${commentsBtn} ${directBtn}</div>
  <div class="articlebody">${sanitizeHnHtml(story.article_html)}</div>
  <div class="btnrow bottom">${commentsBtn} ${directBtn}</div>
</article>`;
  } else {
    body = `
<article class="articlepage">
  <h1>${escapeHtml(story.title)}</h1>
  <p class="empty">No readable article was extracted for this story. Use the direct link to read it live.</p>
  <div class="btnrow">${commentsBtn} ${directBtn}</div>
</article>`;
  }

  res.send(layout(story.article_title || story.title, body));
});

// ---- manual scrape trigger (handy for testing) ----
app.post('/scrape', async (req, res) => {
  const result = await runScrape();
  res.json(result);
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

function start() {
  app.listen(config.port, config.host, () => {
    console.log(`[server] listening on http://${config.host}:${config.port}`);
  });

  if (config.scrapeOnStart) {
    runScrape();
  }
  setInterval(() => { runScrape(); }, config.scrapeIntervalMs);
  console.log(`[server] scrape interval: ${config.scrapeIntervalMs}ms`);
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
