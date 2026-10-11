import { serveMedia } from '../../lib/media-proxy.js';

export function onRequest(context) {
  return serveMedia(context, 'directors');
}
