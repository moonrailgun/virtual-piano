export async function fetchAudioLink(value: string, signal: AbortSignal): Promise<Response> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('videoInvalid'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('videoInvalid');
  signal.throwIfAborted();
  if (/\.(mp3|wav|m4a|ogg|oga|flac|aac|opus|aiff?)$/i.test(url.pathname)) {
    try {
      const response = await fetch(url.href, { signal, credentials: 'omit' });
      const type = response.headers.get('content-type') || '';
      if (response.status === 200 && (!type || /^(audio\/|application\/octet-stream)/i.test(type))) return response;
      await response.body?.cancel();
    } catch { signal.throwIfAborted(); }
  }
  return fetch(`/api/video?${new URLSearchParams({ url: url.href })}`, { signal });
}

export async function readLinkedAudio(response: Response): Promise<Blob> {
  const maxBytes = 100 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error('videoTooLarge');
  }
  let size = 0;
  const body = response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maxBytes) throw new Error('videoTooLarge');
      controller.enqueue(chunk);
    },
  }));
  return new Response(body, { headers: response.headers }).blob();
}
