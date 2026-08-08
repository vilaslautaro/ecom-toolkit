import { describe, it, expect } from 'vitest';
import { readPublishedIndexHtml } from '../support/published-artifact.js';
import { findInvisibleCharacters } from '../support/invisible-characters.js';

const BYTE_ORDER_MARK = 0xfeff;

describe('the index.html that gets published', () => {
  const html = readPublishedIndexHtml();

  it('still carries the core template with both placeholders the page fills in', () => {
    expect(html).toContain('id="mald-core"');
    expect(html).toContain('__CFG__');
    expect(html).toContain('__AUTOSTART__');
  });

  it('carries the bookmarklet built from the modules under src', () => {
    expect(html).toContain('Identificador de la biblioteca');
    expect(html).toContain('Library ID');
    expect(html).toContain('facebook.com/ads/library');
  });

  it('has no invisible characters that would break in transit', () => {
    expect(findInvisibleCharacters(html)).toEqual([]);
  });

  it('declares utf-8 before any content that depends on it', () => {
    const charsetAt = html.indexOf('charset="UTF-8"');

    expect(charsetAt).toBeGreaterThan(-1);
    expect(charsetAt).toBeLessThan(html.indexOf('<body'));
  });

  it('left no trace of the compressed deploy that once broke production', () => {
    expect(html).not.toContain('DecompressionStream');
    expect(html).not.toMatch(/var B\s*=\s*"H4sI/);
  });

  it('does not start with a byte order mark', () => {
    expect(html.charCodeAt(0)).not.toBe(BYTE_ORDER_MARK);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});
