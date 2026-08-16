import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBookmarkletUrl } from '../src/page/bookmarklet-url.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TEMPLATE_PATH = join(ROOT, 'src', 'page', 'index.html');
const STYLES_PATH = join(ROOT, 'src', 'page', 'styles.css');
const BOOKMARKLET_ENTRY = join(ROOT, 'src', 'bookmarklet', 'main.ts');
const PAGE_ENTRY = join(ROOT, 'src', 'page', 'main.ts');
const OUTPUT_PATH = join(ROOT, 'index.html');
const FINGERPRINT_PATH = join(ROOT, 'bookmarklet.sha256');
const DEPLOY_DIRECTORY = join(ROOT, 'dist');
const DEPLOY_OUTPUT_PATH = join(DEPLOY_DIRECTORY, 'index.html');

const STYLES_MARKER = '<!--{{STYLES}}-->';
const BOOKMARKLET_MARKER = '<!--{{BOOKMARKLET_CORE}}-->';
const PAGE_SCRIPT_MARKER = '<!--{{PAGE_SCRIPT}}-->';
const FINGERPRINT_MARKER = '<!--{{BOOKMARKLET_FINGERPRINT}}-->';

const CORE_SCRIPT_ID = 'mald-core';
const CLOSING_SCRIPT_TAG = '</script>';
const CHECK_FLAG = '--check';
const WINDOWS_NEWLINES = /\r\n/g;

const MODULE_SYNTAX: ReadonlyArray<readonly [label: string, pattern: RegExp]> = [
  ['import', /^\s*import[\s({]/m],
  ['export', /^\s*export[\s{*]/m],
  ['require', /\brequire\s*\(/],
];

class BuildError extends Error {}

function relativeToRoot(path: string): string {
  return relative(ROOT, path).split('\\').join('/');
}

async function assertEntryPointExists(entryPoint: string): Promise<void> {
  try {
    await access(entryPoint);
  } catch {
    throw new BuildError(
      `falta ${relativeToRoot(entryPoint)}. Sin ese entry point no se puede armar index.html.`,
    );
  }
}

const MINIFY_BOOKMARKLET_CORE = true;

async function bundleToIife(entryPoint: string, minify: boolean): Promise<string> {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    minify,
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new BuildError(`esbuild no produjo salida para ${relativeToRoot(entryPoint)}.`);
  }

  return output.text;
}

function assertSelfContained(bundle: string, entryPoint: string): void {
  for (const [label, pattern] of MODULE_SYNTAX) {
    if (pattern.test(bundle)) {
      throw new BuildError(
        `el bundle de ${relativeToRoot(entryPoint)} dejó un "${label}" suelto: no es un IIFE autónomo.`,
      );
    }
  }

  if (bundle.includes(CLOSING_SCRIPT_TAG)) {
    throw new BuildError(
      `el bundle de ${relativeToRoot(entryPoint)} contiene "${CLOSING_SCRIPT_TAG}" y cortaría el <script> que lo envuelve.`,
    );
  }
}

function injectAt(template: string, marker: string, content: string): string {
  if (!template.includes(marker)) {
    throw new BuildError(`${relativeToRoot(TEMPLATE_PATH)} no tiene el marcador ${marker}.`);
  }

  return template.replace(marker, () => content);
}

function coreTemplateFrom(html: string): string {
  const openingTag = `id="${CORE_SCRIPT_ID}">`;
  const templateStart = html.indexOf(openingTag);
  if (templateStart === -1) throw new BuildError('el html generado no tiene la plantilla del core.');

  const contentStart = templateStart + openingTag.length;
  const contentEnd = html.indexOf(CLOSING_SCRIPT_TAG, contentStart);
  if (contentEnd === -1) throw new BuildError('la plantilla del core quedo sin cerrar.');

  return html.slice(contentStart, contentEnd);
}

function fingerprintOf(html: string): string {
  const url = buildBookmarkletUrl(coreTemplateFrom(html));
  return createHash('sha256').update(url, 'utf8').digest('hex');
}

async function renderIndexHtml(): Promise<{ html: string; fingerprint: string }> {
  await assertEntryPointExists(BOOKMARKLET_ENTRY);
  await assertEntryPointExists(PAGE_ENTRY);

  const template = await readFile(TEMPLATE_PATH, 'utf8');
  const styles = await readFile(STYLES_PATH, 'utf8');

  const core = await bundleToIife(BOOKMARKLET_ENTRY, MINIFY_BOOKMARKLET_CORE);
  assertSelfContained(core, BOOKMARKLET_ENTRY);

  const pageScript = await bundleToIife(PAGE_ENTRY, false);
  assertSelfContained(pageScript, PAGE_ENTRY);

  const withStyles = injectAt(template, STYLES_MARKER, `<style>\n${styles}</style>`);
  const withCore = injectAt(
    withStyles,
    BOOKMARKLET_MARKER,
    `<script type="text/plain" id="${CORE_SCRIPT_ID}">\n${core}</script>`,
  );
  const withPageScript = injectAt(withCore, PAGE_SCRIPT_MARKER, `<script>\n${pageScript}</script>`);
  const normalized = withPageScript.replace(WINDOWS_NEWLINES, '\n');

  const fingerprint = fingerprintOf(normalized);

  return { html: injectAt(normalized, FINGERPRINT_MARKER, fingerprint), fingerprint };
}

async function readCommittedIndexHtml(): Promise<string> {
  try {
    const committed = await readFile(OUTPUT_PATH, 'utf8');
    return committed.replace(WINDOWS_NEWLINES, '\n');
  } catch {
    throw new BuildError(`no existe ${relativeToRoot(OUTPUT_PATH)}: corré "npm run build".`);
  }
}

async function checkAgainstCommittedIndex(html: string): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'ecom-toolkit-build-'));
  const candidatePath = join(workspace, 'index.html');

  try {
    await writeFile(candidatePath, html, 'utf8');
    const committed = await readCommittedIndexHtml();

    if (committed !== html) {
      throw new BuildError(
        `${relativeToRoot(OUTPUT_PATH)} no coincide con lo que genera el build. Corré "npm run build" y commiteá el resultado.`,
      );
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }

  process.stdout.write(`build:check: ${relativeToRoot(OUTPUT_PATH)} está al día\n`);
}

async function checkFingerprintFile(fingerprint: string): Promise<void> {
  const published = await readFile(FINGERPRINT_PATH, 'utf8').catch(() => null);

  if (published === null) {
    throw new BuildError(`falta ${relativeToRoot(FINGERPRINT_PATH)}: corré "npm run build".`);
  }

  if (published.trim() !== fingerprint) {
    throw new BuildError(
      `${relativeToRoot(FINGERPRINT_PATH)} no coincide con el bookmarklet generado. Corré "npm run build" y commiteá el resultado.`,
    );
  }
}

async function main(): Promise<void> {
  const { html, fingerprint } = await renderIndexHtml();

  if (process.argv.includes(CHECK_FLAG)) {
    await checkAgainstCommittedIndex(html);
    await checkFingerprintFile(fingerprint);
    process.stdout.write(`build:check: huella del bookmarklet al dia (${fingerprint})\n`);
    return;
  }

  await writeFile(OUTPUT_PATH, html, 'utf8');
  await writeFile(FINGERPRINT_PATH, `${fingerprint}\n`, 'utf8');
  await mkdir(DEPLOY_DIRECTORY, { recursive: true });
  await writeFile(DEPLOY_OUTPUT_PATH, html, 'utf8');

  process.stdout.write(
    `build: ${relativeToRoot(OUTPUT_PATH)} regenerado (${html.length} caracteres)\n` +
      `build: huella del bookmarklet ${fingerprint}\n` +
      `build: ${relativeToRoot(DEPLOY_DIRECTORY)}/ listo para deployar\n`,
  );
}

main().catch((error: unknown) => {
  if (error instanceof BuildError) {
    process.stderr.write(`build: ${error.message}\n`);
  } else {
    process.stderr.write(`build: error inesperado\n${String(error)}\n`);
  }
  process.exitCode = 1;
});
