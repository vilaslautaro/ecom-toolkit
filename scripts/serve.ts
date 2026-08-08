import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env['PORT'] ?? 4173);
const DIRECTORY_INDEX = 'index.html';
const ESCAPING_PREFIX = /^(\.\.[/\\])+/;

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function resolveWithinRepository(pathname: string): string | null {
  const requested = pathname.endsWith('/') ? `${pathname}${DIRECTORY_INDEX}` : pathname;
  const resolved = join(REPOSITORY_ROOT, normalize(requested).replace(ESCAPING_PREFIX, ''));
  return resolved.startsWith(REPOSITORY_ROOT) ? resolved : null;
}

async function readServableFile(filePath: string): Promise<Buffer | null> {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return null;
  return readFile(filePath);
}

const server = createServer((request, response) => {
  void (async () => {
    try {
      const { pathname } = new URL(request.url ?? '/', `http://localhost:${PORT}`);
      const filePath = resolveWithinRepository(decodeURIComponent(pathname));

      if (!filePath) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('Forbidden');
        return;
      }

      const contents = await readServableFile(filePath);
      if (!contents) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }

      response.writeHead(200, {
        'content-type': contentTypeFor(filePath),
        'cache-control': 'no-store',
      });
      response.end(contents);
    } catch (error: unknown) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(String(error));
    }
  })();
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already taken. Another dev server is probably still running: ` +
        `stop it, or start this one with a different PORT.`,
    );
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`Ecom Toolkit on http://localhost:${PORT}`);
});
