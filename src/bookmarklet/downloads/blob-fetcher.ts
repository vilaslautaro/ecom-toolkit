const ANONYMOUS_REQUEST: RequestInit = { credentials: 'omit' };

export async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url, ANONYMOUS_REQUEST);
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`);
  return await response.blob();
}
