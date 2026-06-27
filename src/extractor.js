'use strict';

const { JSDOM, VirtualConsole } = require('jsdom');
const { Readability } = require('@mozilla/readability');

// Content types we won't even try to extract as an article.
const NON_HTML = /(pdf|image\/|video\/|audio\/|zip|octet-stream)/i;

async function fetchArticle(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; hnkobo/1.0; +personal e-reader cache)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const ctype = res.headers.get('content-type') || '';
    if (NON_HTML.test(ctype) || (!/text\/html|xhtml|xml/i.test(ctype) && ctype !== '')) {
      return { ok: false, reason: `unsupported content-type: ${ctype}` };
    }
    const html = await res.text();
    return { ok: true, html, finalUrl: res.url || url };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(t);
  }
}

// Returns { status: 'ok'|'failed', title, byline, html } where html is sanitized-ish article body.
async function extract(url, opts = {}) {
  if (!url) return { status: 'failed', reason: 'no url' };
  const fetched = await fetchArticle(url, opts);
  if (!fetched.ok) return { status: 'failed', reason: fetched.reason };

  try {
    const dom = new JSDOM(fetched.html, {
      url: fetched.finalUrl,
      virtualConsole: new VirtualConsole(), // swallow noisy CSS/JS parse errors
    });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.content || article.textContent.trim().length < 200) {
      return { status: 'failed', reason: 'no readable content' };
    }
    return {
      status: 'ok',
      title: article.title || null,
      byline: article.byline || null,
      html: article.content,
    };
  } catch (err) {
    return { status: 'failed', reason: `parse error: ${err.message}` };
  }
}

module.exports = { extract };
