'use client';

import { useState } from 'react';

/**
 * Renders an <img>, but falls back to `fallback` (e.g. an initial letter) when
 * there's no src or the image fails to load — e.g. expired / hotlink-protected
 * WhatsApp CDN URLs that return 403. Drop-in for `{url ? <img/> : initial}`.
 * Place inside a container that provides the box + centering for the fallback.
 */
export default function ImgOrFallback({ src, alt = '', fallback, imgStyle }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...imgStyle }}
    />
  );
}
