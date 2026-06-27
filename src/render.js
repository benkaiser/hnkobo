'use strict';

// Minimal HTML helpers for fast, plaintext-y e-ink rendering.

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// HN comment/story text is already HTML (links, <i>, <p>, <pre>, <code>).
// We trust Algolia's HN-sourced markup but strip <script>/<style> defensively.
function sanitizeHnHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '');
}

function timeAgo(unixSeconds) {
  if (!unixSeconds) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  const units = [
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
  ];
  for (const [secs, label] of units) {
    if (s >= secs) return `${Math.floor(s / secs)}${label} ago`;
  }
  return 'just now';
}

function hostOf(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="topbar"><a href="/" class="home">HN&nbsp;Kobo</a></header>
<main>
${body}
</main>
<script src="/app.js" defer></script>
</body>
</html>`;
}

module.exports = { escapeHtml, sanitizeHnHtml, timeAgo, hostOf, layout };
