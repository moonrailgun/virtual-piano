const headers = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.com/' };

export async function bilibiliAudio(url, signal) {
  const bvid = /^\/video\/(BV[0-9A-Za-z]{10})\/?$/.exec(url.pathname)?.[1];
  const page = Number(url.searchParams.get('p') ?? 1);
  if (url.protocol !== 'https:' || !['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname) || url.username || url.password || url.port || !bvid || !Number.isSafeInteger(page) || page < 1) throw new Error('videoInvalid');

  async function api(path, params) {
    const response = await fetch(`https://api.bilibili.com${path}?${new URLSearchParams(params)}`, { headers, signal, redirect: 'error' });
    if (!response.ok) throw new Error('videoUnavailable');
    const result = await response.json();
    if (result.code !== 0 || !result.data) throw new Error('videoUnavailable');
    return result.data;
  }
  const video = await api('/x/web-interface/view', { bvid });
  const part = video.pages?.[page - 1];
  if (!part?.cid || !Number.isFinite(part.duration) || part.duration <= 0) throw new Error('videoUnavailable');
  if (part.duration > 20 * 60) throw new Error('videoTooLarge');
  const playback = await api('/x/player/playurl', { bvid, cid: String(part.cid), fnval: '16', fnver: '0', fourk: '1' });
  const audio = playback.dash?.audio?.filter(track => track.codecs?.startsWith('mp4a')).sort((a, b) => b.bandwidth - a.bandwidth)[0];
  const sources = audio ? [audio.baseUrl ?? audio.base_url, ...(audio.backupUrl ?? audio.backup_url ?? [])] : [];
  // Prefer a standard CDN URL over peer endpoints on nonstandard ports.
  let source = sources.find(source => source && !new URL(source).port);
  let length = Number(playback.dash?.duration);
  if (!source) {
    // Fall back to a complete MP4 when no standalone audio track is offered.
    const segments = playback.durl;
    length = segments?.reduce((sum, segment) => sum + Number(segment.length), 0) / 1000;
    if (Number.isFinite(length) && length < part.duration - 2) throw new Error('videoIncomplete');
    if (segments?.length !== 1 || playback.format !== 'mp4') throw new Error('videoUnavailable');
    source = segments[0].url;
  }
  if (!Number.isFinite(length) || length < part.duration - 2) throw new Error('videoIncomplete');
  const media = new URL(source);
  if (!['https:', 'http:'].includes(media.protocol) || media.username || media.password || media.port || !['bilivideo.com', 'bilivideo.cn'].some(domain => media.hostname.endsWith(`.${domain}`))) throw new Error('videoUnavailable');
  media.protocol = 'https:';
  return { id: bvid, title: `${video.title || bvid}${video.pages.length > 1 ? ` · ${part.part || page}` : ''}`, duration: part.duration, url: media.href, protocol: 'https', ext: 'mp4', http_headers: headers };
}
