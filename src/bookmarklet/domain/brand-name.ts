const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const PROTOCOL_PREFIX = /^https?:\/\//;
const WWW_PREFIX = /^www\./;
const PATH_OR_QUERY_SEPARATOR = /[/?#\s]/;
const MAX_BRAND_LENGTH = 24;

const META_OWNED_DOMAINS = /facebook|fbcdn|meta\.com|instagram|whatsapp|messenger|fb\.com/i;
const DOMAIN_PATTERN = /([a-z0-9-]+\.)+(com|co|net|shop|io|org|de|es|ar|store)\b/gi;

export function slugify(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, '')
    .slice(0, MAX_BRAND_LENGTH);
}

export function brandFromDomain(value: string | null | undefined): string {
  if (!value) return '';

  const withoutProtocol = String(value).toLowerCase().trim()
    .replace(PROTOCOL_PREFIX, '')
    .replace(WWW_PREFIX, '');

  const host = withoutProtocol.split(PATH_OR_QUERY_SEPARATOR)[0] ?? '';
  const secondLevelName = host.split('.')[0] ?? '';

  return slugify(secondLevelName);
}

export function brandFromSearchQuery(href: string): string {
  try {
    return brandFromDomain(new URL(href).searchParams.get('q'));
  } catch {
    return '';
  }
}

export function brandFromAdvertiserText(text: string): string {
  const domains = (text.match(DOMAIN_PATTERN) ?? []).filter(
    (domain) => !META_OWNED_DOMAINS.test(domain),
  );

  return domains.length > 0 ? brandFromDomain(domains[0]) : '';
}
