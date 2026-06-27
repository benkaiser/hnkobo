'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS stories (
  id            INTEGER PRIMARY KEY,         -- HN story id (objectID)
  title         TEXT NOT NULL,
  url           TEXT,                        -- external article url (null for Ask/Show text posts)
  author        TEXT,
  points        INTEGER,
  num_comments  INTEGER,
  story_text    TEXT,                        -- HTML text for Ask/Show/text posts
  created_at_i  INTEGER NOT NULL,            -- HN post time (unix seconds) -- used for sort
  first_seen_i  INTEGER NOT NULL,            -- when our scraper first saw it
  last_seen_i   INTEGER NOT NULL,            -- last run it was in the above-threshold list
  comments_json TEXT,                        -- cached comment tree (JSON array)
  comments_updated_i INTEGER,
  -- article extraction state: 'pending' | 'ok' | 'failed' | 'none'
  article_status TEXT NOT NULL DEFAULT 'pending',
  article_title TEXT,
  article_byline TEXT,
  article_html  TEXT,
  article_scraped_i INTEGER,
  read_at_i     INTEGER                      -- null = unread
);

CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at_i DESC);
`);

module.exports = db;
