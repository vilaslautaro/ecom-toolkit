const BLOCKED_BY_BROWSER_PATTERN = /failed to fetch|networkerror|load failed|err_blocked|cors/i;
const CLIENT_ERROR_PATTERN = /HTTP 4\d\d/i;
const SERVER_ERROR_PATTERN = /HTTP 5\d\d/i;

const BLOCKED_BY_BROWSER_MESSAGE = 'el navegador bloqueó la bajada del archivo (CORS/red). El servidor de Meta no permite descargarlo directo desde acá.';
const EXPIRED_LINK_HINT = ' (link vencido o sin acceso)';
const META_SERVER_HINT = ' (error del servidor de Meta)';

function readErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { message } = error as { readonly message?: unknown };
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return String(error);
}

export function describeDownloadError(error: unknown): string {
  const message = readErrorMessage(error);

  if (BLOCKED_BY_BROWSER_PATTERN.test(message)) return BLOCKED_BY_BROWSER_MESSAGE;
  if (CLIENT_ERROR_PATTERN.test(message)) return message + EXPIRED_LINK_HINT;
  if (SERVER_ERROR_PATTERN.test(message)) return message + META_SERVER_HINT;

  return message;
}
