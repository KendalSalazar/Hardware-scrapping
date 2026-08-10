import assert from 'node:assert/strict';
import { fetchHtml } from './fetch-html.js';

const html = await fetchHtml(
  'https://faithtechnologycr.com/categoria-producto/almacenamiento/memorias-ram-para-pc/',
);

assert.ok(html);
assert.match(html, /wd-entities-title/);
