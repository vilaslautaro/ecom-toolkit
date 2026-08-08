export interface InvisibleCharacterRange {
  readonly firstCodePoint: number;
  readonly lastCodePoint: number;
  readonly reason: string;
}

export interface InvisibleCharacterFinding {
  readonly codePoint: string;
  readonly reason: string;
  readonly context: string;
}

const CONTEXT_RADIUS = 40;
const CODE_POINT_DIGITS = 4;
const WHITESPACE_RUN = /\s+/g;

export const INVISIBLE_CHARACTER_RANGES: readonly InvisibleCharacterRange[] = [
  { firstCodePoint: 0x0300, lastCodePoint: 0x036f, reason: 'loose combining mark' },
  { firstCodePoint: 0x00ad, lastCodePoint: 0x00ad, reason: 'soft hyphen' },
  { firstCodePoint: 0x200b, lastCodePoint: 0x200f, reason: 'zero width or bidi mark' },
  { firstCodePoint: 0x2028, lastCodePoint: 0x2029, reason: 'line or paragraph separator' },
  { firstCodePoint: 0x202a, lastCodePoint: 0x202e, reason: 'bidi override' },
  { firstCodePoint: 0x2060, lastCodePoint: 0x2064, reason: 'word joiner or invisible operator' },
  { firstCodePoint: 0xfeff, lastCodePoint: 0xfeff, reason: 'byte order mark inside the file' },
];

function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).padStart(CODE_POINT_DIGITS, '0').toUpperCase()}`;
}

export function findInvisibleCharacters(text: string): readonly InvisibleCharacterFinding[] {
  const findings: InvisibleCharacterFinding[] = [];

  for (let position = 0; position < text.length; position += 1) {
    const codePoint = text.charCodeAt(position);
    const range = INVISIBLE_CHARACTER_RANGES.find(
      (candidate) => codePoint >= candidate.firstCodePoint && codePoint <= candidate.lastCodePoint,
    );
    if (!range) continue;

    findings.push({
      codePoint: formatCodePoint(codePoint),
      reason: range.reason,
      context: text
        .slice(Math.max(0, position - CONTEXT_RADIUS), position + CONTEXT_RADIUS)
        .replace(WHITESPACE_RUN, ' '),
    });
  }

  return findings;
}
