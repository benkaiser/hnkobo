'use strict';

const SEARCH = 'https://hn.algolia.com/api/v1/search_by_date';
const ITEM = 'https://hn.algolia.com/api/v1/items';

async function fetchJson(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'hnkobo/1.0 (personal e-reader cache)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Most-recent stories above the points threshold, sorted by date desc.
async function fetchTopStories(pointsThreshold, limit) {
  const filter = encodeURIComponent(`points>${pointsThreshold}`);
  const url = `${SEARCH}?tags=story&numericFilters=${filter}&hitsPerPage=${limit}`;
  const data = await fetchJson(url, { timeoutMs: 20000 });
  return (data.hits || []).map((h) => ({
    id: Number(h.objectID),
    title: h.title || '(untitled)',
    url: h.url || null,
    author: h.author || null,
    points: h.points || 0,
    num_comments: h.num_comments || 0,
    story_text: h.story_text || h.text || null,
    created_at_i: h.created_at_i,
  }));
}

// Full nested comment tree for a story in a single request.
async function fetchItem(id) {
  return fetchJson(`${ITEM}/${id}`, { timeoutMs: 20000 });
}

module.exports = { fetchTopStories, fetchItem };
