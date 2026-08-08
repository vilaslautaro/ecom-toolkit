import { JSDOM } from 'jsdom';

export interface DownloadRecord {
  readonly fileName: string;
  readonly href: string;
}

export interface CreatedObjectUrl {
  readonly url: string;
  readonly blob: Blob;
}

export interface StubbedRoute {
  readonly status?: number;
  readonly statusText?: string;
  readonly byteSize?: number;
  readonly contentType?: string;
  readonly text?: string;
  readonly json?: unknown;
  readonly throws?: unknown;
}

export type StubbedRoutes = Readonly<Record<string, StubbedRoute>>;

export interface StubFetchOptions {
  readonly onRequest?: (url: string) => void;
}

export interface PageEnvironmentOptions {
  readonly url?: string;
  readonly html?: string;
}

export interface PageEnvironment {
  readonly window: Window & typeof globalThis;
  readonly document: Document;
  readonly downloads: readonly DownloadRecord[];
  readonly createdObjectUrls: readonly CreatedObjectUrl[];
  readonly stubFetch: (routes: StubbedRoutes, options?: StubFetchOptions) => readonly string[];
  readonly requireElement: (selector: string) => Element;
  readonly restore: () => void;
}

const DEFAULT_PAGE_URL = 'https://example.com/';
const EMPTY_PAGE_HTML = '<!doctype html><html><body></body></html>';
const NATURAL_WIDTH_ATTRIBUTE = 'data-natural-width';
const DOWNLOAD_ATTRIBUTE = 'download';
const OBJECT_URL_PREFIX = 'blob:mock/';
const DEFAULT_ROUTE_KEY = 'default';
const LOWEST_OK_STATUS = 200;
const LOWEST_REDIRECT_STATUS = 300;
const DEFAULT_BYTE_SIZE = 1024;
const DEFAULT_CONTENT_TYPE = 'video/mp4';

const globalScope = globalThis as unknown as Record<string, unknown>;

const openEnvironments: PageEnvironment[] = [];

type TimerScheduler = (callback: () => void, delayMs?: number, ...args: unknown[]) => unknown;

interface DetachableTimer {
  readonly unref: () => void;
}

const scheduleRealTimer = globalScope['setTimeout'] as TimerScheduler;
const cancelRealTimer = globalScope['clearTimeout'] as (handle: unknown) => void;

function isDetachableTimer(handle: unknown): handle is DetachableTimer {
  return (
    typeof handle === 'object'
    && handle !== null
    && typeof (handle as DetachableTimer).unref === 'function'
  );
}

function trackTimers(): { readonly scheduler: TimerScheduler; readonly cancelAll: () => void } {
  const pendingHandles = new Set<unknown>();

  const scheduler: TimerScheduler = (callback, delayMs, ...args) => {
    const handle = scheduleRealTimer(callback, delayMs, ...args);
    if (isDetachableTimer(handle)) handle.unref();
    pendingHandles.add(handle);
    return handle;
  };

  return {
    scheduler,
    cancelAll: () => {
      for (const handle of pendingHandles) cancelRealTimer(handle);
      pendingHandles.clear();
    },
  };
}

function asMutableRecord(value: object): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

function installGlobals(values: Readonly<Record<string, unknown>>): () => void {
  const previousValues = new Map<string, unknown>();

  for (const [name, value] of Object.entries(values)) {
    previousValues.set(name, globalScope[name]);
    globalScope[name] = value;
  }

  return () => {
    for (const [name, previousValue] of previousValues) {
      globalScope[name] = previousValue;
    }
  };
}

function polyfillVisibleText(window: Window & typeof globalThis): void {
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    get(this: HTMLElement): string {
      return this.textContent ?? '';
    },
    configurable: true,
  });
}

function polyfillNaturalWidth(window: Window & typeof globalThis): void {
  Object.defineProperty(window.HTMLImageElement.prototype, 'naturalWidth', {
    get(this: HTMLImageElement): number {
      return Number(this.getAttribute(NATURAL_WIDTH_ATTRIBUTE) ?? 0);
    },
    configurable: true,
  });
}

function polyfillScrolling(window: Window & typeof globalThis): void {
  Object.defineProperty(window, 'scrollTo', {
    value: (): void => undefined,
    configurable: true,
    writable: true,
  });
}

function spyOnDownloadClicks(
  window: Window & typeof globalThis,
  downloads: DownloadRecord[],
): void {
  const anchorPrototype = window.HTMLAnchorElement.prototype;
  const clickThrough = anchorPrototype.click;

  anchorPrototype.click = function click(this: HTMLAnchorElement): void {
    if (!this.hasAttribute(DOWNLOAD_ATTRIBUTE)) {
      clickThrough.call(this);
      return;
    }

    downloads.push({
      fileName: this.getAttribute(DOWNLOAD_ATTRIBUTE) ?? '',
      href: this.getAttribute('href') ?? '',
    });
  };
}

function stubObjectUrls(createdObjectUrls: CreatedObjectUrl[]): () => void {
  const urlStatics = asMutableRecord(URL);
  const previousCreate = urlStatics['createObjectURL'];
  const previousRevoke = urlStatics['revokeObjectURL'];

  urlStatics['createObjectURL'] = (blob: Blob): string => {
    const url = `${OBJECT_URL_PREFIX}${createdObjectUrls.length}`;
    createdObjectUrls.push({ url, blob });
    return url;
  };
  urlStatics['revokeObjectURL'] = (): void => undefined;

  return () => {
    urlStatics['createObjectURL'] = previousCreate;
    urlStatics['revokeObjectURL'] = previousRevoke;
  };
}

function buildStubbedResponse(route: StubbedRoute): Response {
  const status = route.status ?? LOWEST_OK_STATUS;

  const response = {
    ok: status >= LOWEST_OK_STATUS && status < LOWEST_REDIRECT_STATUS,
    status,
    statusText: route.statusText ?? '',
    blob: (): Promise<Blob> =>
      Promise.resolve(
        new Blob([new Uint8Array(route.byteSize ?? DEFAULT_BYTE_SIZE)], {
          type: route.contentType ?? DEFAULT_CONTENT_TYPE,
        }),
      ),
    text: (): Promise<string> => Promise.resolve(route.text ?? ''),
    json: (): Promise<unknown> => Promise.resolve(route.json ?? {}),
  };

  return response as unknown as Response;
}

function routeFor(routes: StubbedRoutes, url: string): StubbedRoute | undefined {
  const matchedKey = Object.keys(routes)
    .filter((key) => key !== DEFAULT_ROUTE_KEY)
    .find((key) => url.includes(key));

  return matchedKey === undefined ? routes[DEFAULT_ROUTE_KEY] : routes[matchedKey];
}

function unstubbedFetch(url: string): never {
  throw new Error(`the test did not stub fetch, but the code requested: ${url}`);
}

export function createPageEnvironment(options: PageEnvironmentOptions = {}): PageEnvironment {
  const dom = new JSDOM(options.html ?? EMPTY_PAGE_HTML, {
    url: options.url ?? DEFAULT_PAGE_URL,
    pretendToBeVisual: true,
  });

  const window = dom.window as unknown as Window & typeof globalThis;
  const downloads: DownloadRecord[] = [];
  const createdObjectUrls: CreatedObjectUrl[] = [];

  polyfillVisibleText(window);
  polyfillNaturalWidth(window);
  polyfillScrolling(window);
  spyOnDownloadClicks(window, downloads);

  const timers = trackTimers();
  const restoreObjectUrls = stubObjectUrls(createdObjectUrls);
  const restoreGlobals = installGlobals({
    window,
    document: window.document,
    location: window.location,
    setTimeout: timers.scheduler,
    fetch: (input: unknown): never => unstubbedFetch(String(input)),
  });

  const environment: PageEnvironment = {
    window,
    document: window.document,
    downloads,
    createdObjectUrls,

    stubFetch: (routes, stubOptions) => {
      const requestedUrls: string[] = [];

      globalScope['fetch'] = (input: unknown): Promise<Response> => {
        const url = String(input);
        requestedUrls.push(url);
        stubOptions?.onRequest?.(url);

        const route = routeFor(routes, url);
        if (!route) return Promise.reject(new TypeError('Failed to fetch'));
        if (route.throws !== undefined) return Promise.reject(route.throws);

        return Promise.resolve(buildStubbedResponse(route));
      };

      return requestedUrls;
    },

    requireElement: (selector) => {
      const element = window.document.querySelector(selector);
      if (!element) throw new Error(`no element matched the selector: ${selector}`);
      return element;
    },

    restore: () => {
      timers.cancelAll();
      restoreGlobals();
      restoreObjectUrls();
      window.close();
    },
  };

  openEnvironments.push(environment);

  return environment;
}

export function closeOpenPages(): void {
  while (openEnvironments.length > 0) {
    openEnvironments.pop()?.restore();
  }
}
