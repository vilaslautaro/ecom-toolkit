const DROPI_HOST_FRAGMENT = 'app.dropi';
const WWW_PREFIX = /^www\./;
const QUERY_OR_HASH = /[?#]/;
const HYPHENS = /-/g;

const AD_LIBRARY_QUERY_PREFIX =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=';
const AD_LIBRARY_QUERY_SUFFIX =
  '&search_type=keyword_unordered&media_type=all&sort_data[mode]=total_impressions&sort_data[direction]=desc';

function lastPathSegment(href: string): string {
  const afterLastSlash = href.substring(href.lastIndexOf('/') + 1);
  return afterLastSlash.split(QUERY_OR_HASH)[0] ?? '';
}

export function detectStoreBrand(): string {
  const href = location.href;

  if (href.includes(DROPI_HOST_FRAGMENT)) {
    return lastPathSegment(href).replace(HYPHENS, ' ').trim();
  }

  return location.hostname.replace(WWW_PREFIX, '');
}

export function adLibrarySearchUrl(brand: string): string {
  return `${AD_LIBRARY_QUERY_PREFIX}${encodeURIComponent(brand)}${AD_LIBRARY_QUERY_SUFFIX}`;
}
