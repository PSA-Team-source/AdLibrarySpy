// Storefront fact parsers (lib/market/storefront.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTheme, parseLocale, parseHandles } from '../lib/market/storefront-parse.ts';

test('theme is the schema name, not the merchant copy name', () => {
  const html = 'Shopify.theme = {"name":"resilia-old\\/main","id":1,"schema_name":"Impulse","role":"main"};';
  assert.equal(parseTheme(html), 'Impulse');
  assert.equal(parseTheme('Shopify.theme = {"name":"custom","schema_name":null};'), '');
  assert.equal(parseTheme('<html>'), '');
});

test('locale from Shopify.locale, else <html lang>', () => {
  assert.equal(parseLocale('Shopify.locale = "en";'), 'en');
  assert.equal(parseLocale('<html class="x" lang="de-DE">'), 'de-DE');
  assert.equal(parseLocale('<html>'), '');
});

test('handles follow collection order from <main>, deduped, menu links skipped', () => {
  const html = '<nav><a href="/products/menu-item">m</a></nav><main><a href="/collections/all/products/b-one?v=1">'
    + '<a href="/products/b-one"><a href="/products/two%C3%A9"><a href="/products/three#x"></main>';
  assert.deepEqual(parseHandles(html), ['b-one', 'twoé', 'three']);
  assert.deepEqual(parseHandles(html, 2), ['b-one', 'twoé']);
});
