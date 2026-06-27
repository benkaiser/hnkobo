'use strict';

// One-off scrape for manual testing / cron-style invocation.
const { runScrape } = require('./scraper');

runScrape().then((r) => {
  console.log('[scrape-once] result:', JSON.stringify(r));
  process.exit(r && r.error ? 1 : 0);
}).catch((err) => {
  console.error('[scrape-once] fatal:', err);
  process.exit(1);
});
