import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SerializedBookmarkletConfig } from '../../src/bookmarklet/domain/serialized-config.js';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CORE_TEMPLATE_OPENING_TAG = 'id="mald-core">';
const CLOSING_SCRIPT_TAG = '</script>';
const CONFIG_PLACEHOLDER = '__CFG__';
const AUTOSTART_PLACEHOLDER = '__AUTOSTART__';
const BOOKMARKLET_PROTOCOL = 'javascript:';

export const PUBLISHED_INDEX_PATH = join(REPOSITORY_ROOT, 'index.html');

export const DEFAULT_SERIALIZED_CONFIG: SerializedBookmarkletConfig = {
  minAds: 2,
  tipo: 'auto',
  skipLow: true,
  portada: false,
  autoscroll: true,
  maxCards: 50,
  delayMs: 1200,
};

export function readPublishedIndexHtml(): string {
  return readFileSync(PUBLISHED_INDEX_PATH, 'utf8');
}

export function readCoreTemplate(): string {
  const html = readPublishedIndexHtml();

  const openingTagAt = html.indexOf(CORE_TEMPLATE_OPENING_TAG);
  if (openingTagAt === -1) {
    throw new Error(`index.html no longer has the <script ${CORE_TEMPLATE_OPENING_TAG} template`);
  }

  const templateStart = openingTagAt + CORE_TEMPLATE_OPENING_TAG.length;
  const templateEnd = html.indexOf(CLOSING_SCRIPT_TAG, templateStart);
  if (templateEnd === -1) throw new Error('the core template script is never closed');

  const template = html.slice(templateStart, templateEnd);
  if (!template.includes(CONFIG_PLACEHOLDER)) {
    throw new Error(`the core template lost the ${CONFIG_PLACEHOLDER} placeholder`);
  }
  if (!template.includes(AUTOSTART_PLACEHOLDER)) {
    throw new Error(`the core template lost the ${AUTOSTART_PLACEHOLDER} placeholder`);
  }

  return template;
}

export function buildBookmarkletCore(
  config: SerializedBookmarkletConfig = DEFAULT_SERIALIZED_CONFIG,
  autoStart = false,
): string {
  return readCoreTemplate()
    .split(CONFIG_PLACEHOLDER)
    .join(JSON.stringify(config))
    .split(AUTOSTART_PLACEHOLDER)
    .join(String(autoStart));
}

export function buildBookmarkletUrl(
  config: SerializedBookmarkletConfig = DEFAULT_SERIALIZED_CONFIG,
): string {
  const core = buildBookmarkletCore(config, false);
  return BOOKMARKLET_PROTOCOL + encodeURIComponent(`(function(){${core}})();`);
}
