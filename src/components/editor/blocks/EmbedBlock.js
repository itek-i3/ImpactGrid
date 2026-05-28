'use client';

import { useState } from 'react';
import { Link, ExternalLink } from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * EmbedBlock — embed URLs (YouTube, Google Maps, etc.) as iframes.
 */
export default function EmbedBlock({ block, onUpdate, readOnly = false }) {
  const [inputUrl, setInputUrl] = useState('');
  const url = block.content?.url || '';

  const getEmbedUrl = (rawUrl) => {
    // YouTube
    const ytMatch = rawUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    // Vimeo
    const vimeoMatch = rawUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    // Google Maps
    if (rawUrl.includes('google.com/maps')) {
      return rawUrl.replace('/maps/', '/maps/embed/');
    }

    // Figma
    if (rawUrl.includes('figma.com')) {
      return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(rawUrl)}`;
    }

    // Default: use as-is (for sites that allow iframe embedding)
    return rawUrl;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onUpdate({
        content: {
          url: inputUrl.trim(),
          embedUrl: getEmbedUrl(inputUrl.trim()),
        },
      });
    }
  };

  if (url) {
    return (
      <div className={styles.embedBlock}>
        <div className={styles.embedPreview}>
          <iframe
            src={block.content?.embedUrl || getEmbedUrl(url)}
            width="100%"
            height="400"
            allowFullScreen
            title="Embed"
            loading="lazy"
          />
        </div>
        <div style={{ marginTop: 'var(--space-1)', display: 'flex', alignItems: 'center' }}>
          {!readOnly && (
            <button
              className={styles.codeCopyBtn}
              onClick={() => onUpdate({ content: { url: '', embedUrl: '' } })}
            >
              Remove embed
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.codeCopyBtn}
            style={{
              display: 'inline-flex',
              marginLeft: readOnly ? '0' : 'var(--space-2)',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} style={{ marginRight: '4px', marginTop: '2px' }} /> Open original
          </a>
        </div>
      </div>
    );
  }

  if (readOnly) return null;

  return (
    <div className={styles.embedBlock}>
      <form className={styles.embedInput} onSubmit={handleSubmit}>
        <Link size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <input
          className={styles.embedInputField}
          type="url"
          placeholder="Paste a URL (YouTube, Vimeo, Figma, Google Maps...)"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          className={styles.codeCopyBtn}
          style={{ flexShrink: 0 }}
        >
          Embed
        </button>
      </form>
    </div>
  );
}
