'use strict';

const path = require('path');
require('dotenv').config();

function int(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

function bool(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

const root = path.resolve(__dirname, '..');

const dbPath = process.env.DB_PATH && process.env.DB_PATH.trim() !== ''
  ? process.env.DB_PATH.trim()
  : 'data/hnkobo.db';

const config = {
  root,
  pointsThreshold: int('POINTS_THRESHOLD', 300),
  storyLimit: int('STORY_LIMIT', 40),
  scrapeIntervalMs: int('SCRAPE_INTERVAL_MS', 60 * 60 * 1000),
  retentionDays: int('RETENTION_DAYS', 7),
  port: int('PORT', 8089),
  host: process.env.HOST && process.env.HOST.trim() !== '' ? process.env.HOST.trim() : '0.0.0.0',
  dbPath: path.isAbsolute(dbPath) ? dbPath : path.join(root, dbPath),
  articleTimeoutMs: int('ARTICLE_TIMEOUT_MS', 15000),
  articleConcurrency: int('ARTICLE_CONCURRENCY', 4),
  scrapeOnStart: bool('SCRAPE_ON_START', true),
};

module.exports = config;
