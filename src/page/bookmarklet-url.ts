import { DEFAULT_BOOKMARKLET_CONFIG, serializeBookmarkletConfig } from './bookmarklet-config.js';
import type { SerializedBookmarkletConfig } from '../bookmarklet/domain/serialized-config.js';

export const CORE_TEMPLATE_ID = 'mald-core';
export const CONFIG_PLACEHOLDER = '__CFG__';
export const AUTOSTART_PLACEHOLDER = '__AUTOSTART__';
export const BOOKMARKLET_PROTOCOL = 'javascript:';

export const DEFAULT_SERIALIZED_CONFIG: SerializedBookmarkletConfig =
  serializeBookmarkletConfig(DEFAULT_BOOKMARKLET_CONFIG);

export function fillCoreTemplate(
  coreTemplate: string,
  config: SerializedBookmarkletConfig = DEFAULT_SERIALIZED_CONFIG,
  autoStart = false,
): string {
  return coreTemplate
    .split(CONFIG_PLACEHOLDER)
    .join(JSON.stringify(config))
    .split(AUTOSTART_PLACEHOLDER)
    .join(String(autoStart));
}

export function buildBookmarkletUrl(
  coreTemplate: string,
  config: SerializedBookmarkletConfig = DEFAULT_SERIALIZED_CONFIG,
  autoStart = false,
): string {
  const core = fillCoreTemplate(coreTemplate, config, autoStart);
  return `${BOOKMARKLET_PROTOCOL}${encodeURIComponent(`(function(){${core}})();`)}`;
}
