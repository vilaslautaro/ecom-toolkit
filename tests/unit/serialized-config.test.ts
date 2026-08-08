import { describe, it, expect } from 'vitest';
import {
  deserializeBookmarkletConfig,
  serializeBookmarkletConfig,
  toCreativeSelection,
} from '../../src/bookmarklet/domain/serialized-config.js';
import type { SerializedBookmarkletConfig } from '../../src/bookmarklet/domain/serialized-config.js';
import { buildSessionConfig } from '../support/ad-fixtures.js';

const SERIALIZED: SerializedBookmarkletConfig = {
  minAds: 2,
  tipo: 'video',
  skipLow: true,
  portada: false,
  autoscroll: true,
  maxCards: 50,
  delayMs: 1200,
};

describe('toCreativeSelection', () => {
  it.each(['auto', 'video', 'imagen'] as const)('keeps the known selection %s', (selection) => {
    expect(toCreativeSelection(selection)).toBe(selection);
  });

  it('falls back to auto for anything the stored bookmarklet does not know', () => {
    expect(toCreativeSelection('gif')).toBe('auto');
    expect(toCreativeSelection('')).toBe('auto');
  });
});

describe('serializeBookmarkletConfig', () => {
  it('renames every field to the short keys embedded in the bookmarklet url', () => {
    const config = buildSessionConfig({
      minimumCopiesInRotation: 2,
      creativeSelection: 'video',
      skipLowImpressions: true,
      includeVideoPoster: false,
      autoScroll: true,
      maximumDownloads: 50,
      delayBetweenDownloadsMs: 1200,
    });

    expect(serializeBookmarkletConfig(config)).toEqual(SERIALIZED);
  });
});

describe('deserializeBookmarkletConfig', () => {
  it('restores the same configuration that was serialized', () => {
    expect(serializeBookmarkletConfig(deserializeBookmarkletConfig(SERIALIZED))).toEqual(
      SERIALIZED,
    );
  });

  it('reads the creative selection through the fallback so an unknown value becomes auto', () => {
    const config = deserializeBookmarkletConfig({ ...SERIALIZED, tipo: 'gif' });
    expect(config.creativeSelection).toBe('auto');
  });

  it('replaces a zero delay with the default so a saved bookmarklet never hammers Meta', () => {
    const config = deserializeBookmarkletConfig({ ...SERIALIZED, delayMs: 0 });
    expect(config.delayBetweenDownloadsMs).toBe(1200);
  });
});
