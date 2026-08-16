import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTOSTART_PLACEHOLDER,
  CONFIG_PLACEHOLDER,
  CORE_TEMPLATE_ID,
  DEFAULT_SERIALIZED_CONFIG,
  fillCoreTemplate,
  buildBookmarkletUrl as buildUrlFromTemplate,
} from '../../src/page/bookmarklet-url.js';
import type { SerializedBookmarkletConfig } from '../../src/bookmarklet/domain/serialized-config.js';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CORE_TEMPLATE_OPENING_TAG = `id="${CORE_TEMPLATE_ID}">`;
const CLOSING_SCRIPT_TAG = '</script>';

export const PUBLISHED_INDEX_PATH = join(REPOSITORY_ROOT, 'index.html');
export const PUBLISHED_FINGERPRINT_PATH = join(REPOSITORY_ROOT, 'bookmarklet.sha256');

export { DEFAULT_SERIALIZED_CONFIG };

export function readPublishedIndexHtml(): string {
  return readFileSync(PUBLISHED_INDEX_PATH, 'utf8');
}

export function readPublishedFingerprint(): string {
  return readFileSync(PUBLISHED_FINGERPRINT_PATH, 'utf8').trim();
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
  return fillCoreTemplate(readCoreTemplate(), config, autoStart);
}

export function buildBookmarkletUrl(
  config: SerializedBookmarkletConfig = DEFAULT_SERIALIZED_CONFIG,
): string {
  return buildUrlFromTemplate(readCoreTemplate(), config, false);
}
