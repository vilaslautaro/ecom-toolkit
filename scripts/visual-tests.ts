import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WINDOWS_SEPARATOR = /\\/g;

const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.62.1-noble';
const CONTAINER_WORKSPACE = '/work';
const CONTAINER_NODE_MODULES = `${CONTAINER_WORKSPACE}/node_modules`;
const CONTAINER_NPM_CACHE = '/root/.npm';
const NPM_CACHE_VOLUME = 'ecom-toolkit-visual-npm-cache';
const DOCKER_IS_MISSING = 'ENOENT';

const INSTALL_COMMAND = 'npm ci --no-audit --no-fund';
const TEST_COMMAND = 'npx playwright test --project=visual';

const DOCKER_UNAVAILABLE_MESSAGE =
  'The visual suite runs inside the official Playwright image so the baselines match CI. '
  + 'Start Docker Desktop and try again.';

function containerPathOf(hostPath: string): string {
  return hostPath.replace(WINDOWS_SEPARATOR, '/');
}

function containerCommandWith(playwrightArguments: readonly string[]): string {
  return [INSTALL_COMMAND, [TEST_COMMAND, ...playwrightArguments].join(' ')].join(' && ');
}

const dockerArguments: readonly string[] = [
  'run',
  '--rm',
  '--init',
  '--ipc=host',
  '--volume',
  `${containerPathOf(REPOSITORY_ROOT)}:${CONTAINER_WORKSPACE}`,
  '--volume',
  CONTAINER_NODE_MODULES,
  '--volume',
  `${NPM_CACHE_VOLUME}:${CONTAINER_NPM_CACHE}`,
  '--workdir',
  CONTAINER_WORKSPACE,
  '--env',
  'VISUAL_SNAPSHOTS=1',
  PLAYWRIGHT_IMAGE,
  'sh',
  '-c',
  containerCommandWith(process.argv.slice(2)),
];

const run = spawnSync('docker', [...dockerArguments], { stdio: 'inherit' });

if (run.error) {
  const reason = (run.error as NodeJS.ErrnoException).code === DOCKER_IS_MISSING
    ? DOCKER_UNAVAILABLE_MESSAGE
    : run.error.message;

  console.error(reason);
  process.exit(1);
}

process.exit(run.status ?? 1);
