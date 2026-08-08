import { deserializeBookmarkletConfig } from './domain/serialized-config.js';
import { buildAdLibraryPanel } from './ad-library/ad-library-panel.js';
import { buildStorePanel } from './shopify/shopify-panel.js';
import type { SerializedBookmarkletConfig } from './domain/serialized-config.js';

declare const __CFG__: SerializedBookmarkletConfig;
declare const __AUTOSTART__: boolean;

const AD_LIBRARY_LOCATION = /facebook\.com\/ads\/library/i;
const DOCUMENT_READY_POLL_MS = 800;

function openPanelForCurrentPage(): void {
  if (AD_LIBRARY_LOCATION.test(location.href)) {
    buildAdLibraryPanel({
      defaults: deserializeBookmarkletConfig(__CFG__),
      autoStart: __AUTOSTART__,
    });
    return;
  }

  void buildStorePanel();
}

function openPanelWhenDocumentIsReady(): void {
  const poll = setInterval(() => {
    if (!document.body) return;
    clearInterval(poll);
    openPanelForCurrentPage();
  }, DOCUMENT_READY_POLL_MS);
}

openPanelWhenDocumentIsReady();
