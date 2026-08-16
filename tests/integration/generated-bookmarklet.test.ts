import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  DEFAULT_SERIALIZED_CONFIG,
  buildBookmarkletCore,
  buildBookmarkletUrl,
  readPublishedFingerprint,
  readPublishedIndexHtml,
} from '../support/published-artifact.js';
import { findInvisibleCharacters } from '../support/invisible-characters.js';

const BOOKMARKLET_PROTOCOL = 'javascript:';
const BOOKMARKLET_URL_LENGTH_BUDGET = 50_000;
const REMOVED_TEST_HOOK = '__ECOM_TOOLKIT_TEST__';
const SHA256_HEX = /^[0-9a-f]{64}$/;

function sha256Of(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('the fingerprint that lets a user verify what they copied', () => {
  it('matches the sha256 of the bookmarklet the page actually hands out', () => {
    expect(readPublishedFingerprint()).toBe(sha256Of(buildBookmarkletUrl()));
  });

  it('is published as a plain sha256 digest', () => {
    expect(readPublishedFingerprint()).toMatch(SHA256_HEX);
  });

  it('is shown on the page itself, so it can be compared without cloning the repo', () => {
    expect(readPublishedIndexHtml()).toContain(readPublishedFingerprint());
  });

  it('changes when the bookmarklet changes, or it would guarantee nothing', () => {
    const tampered = `${buildBookmarkletUrl()}%20`;

    expect(sha256Of(tampered)).not.toBe(readPublishedFingerprint());
  });
});

describe('the bookmarklet the page hands to the user', () => {
  it('is syntactically valid JavaScript once wrapped in its IIFE', () => {
    const core = buildBookmarkletCore();

    expect(() => new Function(`(function(){${core}})`)).not.toThrow();
  });

  it('replaces the configuration without leaving a placeholder behind', () => {
    const core = buildBookmarkletCore({ ...DEFAULT_SERIALIZED_CONFIG, maxCards: 7 });

    expect(core).not.toContain('__CFG__');
    expect(core).not.toContain('__AUTOSTART__');
    expect(core).toContain('"maxCards":7');
  });

  it('carries the default configuration the page advertises', () => {
    const core = buildBookmarkletCore();

    expect(core).toContain('"minAds":2');
    expect(core).toContain('"maxCards":50');
    expect(core).toContain('"skipLow":true');
  });

  it('survives the encodeURIComponent round trip that storing it in a bookmark implies', () => {
    const bookmarklet = buildBookmarkletUrl();

    expect(bookmarklet.startsWith(BOOKMARKLET_PROTOCOL)).toBe(true);

    const decoded = decodeURIComponent(bookmarklet.slice(BOOKMARKLET_PROTOCOL.length));

    expect(() => new Function(decoded)).not.toThrow();
  });

  it('loses no character in the round trip and gains no invisible one', () => {
    const core = buildBookmarkletCore();
    const roundTripped = decodeURIComponent(encodeURIComponent(core));

    expect(roundTripped).toBe(core);
    expect(findInvisibleCharacters(roundTripped)).toEqual([]);
  });

  it('keeps the url inside the size budget that turning minification off would blow', () => {
    expect(buildBookmarkletUrl().length).toBeLessThan(BOOKMARKLET_URL_LENGTH_BUDGET);
  });

  it('drags no external dependency along, because it has to run on its own', () => {
    const core = buildBookmarkletCore();

    expect(core).not.toMatch(/^\s*import[\s({]/m);
    expect(core).not.toMatch(/^\s*export[\s{*]/m);
    expect(core).not.toMatch(/\brequire\(/);
    expect(core).not.toMatch(/<script[^>]+src=/);
  });

  it('carries no closing script tag that would cut the tag wrapping it', () => {
    expect(buildBookmarkletCore()).not.toContain('</script>');
  });

  it('waits for the document and then opens the panel by itself', () => {
    const core = buildBookmarkletCore();

    expect(core).toContain('setInterval');
    expect(core).not.toContain(REMOVED_TEST_HOOK);
  });

  it('keeps the strings the user reads while it works', () => {
    const core = buildBookmarkletCore();

    expect(core).toContain('Descargados: ');
    expect(core).toContain('saltados por pocas impresiones: ');
    expect(core).toContain('No detecté ninguna tarjeta');
    expect(core).toContain('Anuncios en esta búsqueda: ');
    expect(core).toContain('no parece una tienda Shopify');
  });
});
