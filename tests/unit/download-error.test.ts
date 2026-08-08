import { describe, it, expect } from 'vitest';
import { describeDownloadError } from '../../src/bookmarklet/downloads/download-error.js';

describe('describeDownloadError', () => {
  it('turns a browser level network block into something the user can act on', () => {
    const description = describeDownloadError(new TypeError('Failed to fetch'));

    expect(description).toContain('bloqueó la bajada');
    expect(description).not.toContain('Failed to fetch');
  });

  it.each([
    'NetworkError when attempting to fetch resource',
    'Load failed',
    'blocked by CORS policy',
    'net::ERR_BLOCKED_BY_CLIENT',
  ])('recognises %s as the same network block', (message) => {
    expect(describeDownloadError(new Error(message))).toContain('bloqueó la bajada');
  });

  it('explains a 4xx as an expired or forbidden link', () => {
    expect(describeDownloadError(new Error('HTTP 403 Forbidden'))).toContain(
      'link vencido o sin acceso',
    );
    expect(describeDownloadError(new Error('HTTP 404 Not Found'))).toContain(
      'link vencido o sin acceso',
    );
  });

  it('explains a 5xx as a problem on the Meta side', () => {
    expect(describeDownloadError(new Error('HTTP 503'))).toContain('error del servidor de Meta');
  });

  it('passes through untouched whatever it does not recognise', () => {
    expect(describeDownloadError(new Error('algo raro'))).toBe('algo raro');
  });

  it('never throws when it receives something that is not an Error', () => {
    expect(describeDownloadError('texto suelto')).toBe('texto suelto');
    expect(describeDownloadError(null)).toBe('null');
    expect(describeDownloadError(undefined)).toBe('undefined');
    expect(describeDownloadError({ message: '' })).toContain('object');
  });
});
