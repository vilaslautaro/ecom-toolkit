export async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`);
  return await response.blob();
}
