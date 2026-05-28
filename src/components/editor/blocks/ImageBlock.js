'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * ImageBlock — upload/URL image with caption.
 * In demo mode, supports file upload via FileReader (data URL).
 * When Supabase is connected, uploads to Supabase Storage.
 */
export default function ImageBlock({ block, onUpdate, readOnly = false }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const src = block.content?.src || '';

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpdate({
        content: {
          ...block.content,
          src: e.target.result,
          fileName: file.name,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleUrlEmbed = () => {
    const url = prompt('Paste image URL:');
    if (url) {
      onUpdate({ content: { ...block.content, src: url } });
    }
  };

  if (src) {
    return (
      <div className={styles.imageBlock}>
        <div className={styles.imagePreview}>
          <img src={src} alt={block.content?.caption || 'Image'} />
          {!readOnly && (
            <div className={styles.imageActions}>
              <button
                className={styles.codeCopyBtn}
                onClick={() =>
                  onUpdate({ content: { ...block.content, src: '' } })
                }
              >
                <X size={14} /> Remove
              </button>
            </div>
          )}
        </div>
        {(block.content?.caption || !readOnly) && (
          <div
            className={styles.imageCaption}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onInput={(e) =>
              onUpdate({
                content: { ...block.content, caption: e.target.innerText },
              })
            }
            dangerouslySetInnerHTML={{
              __html: block.content?.caption || '',
            }}
          />
        )}
      </div>
    );
  }

  if (readOnly) return null;

  return (
    <div className={styles.imageBlock}>
      <div
        className={styles.imageUploadArea}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={
          dragOver
            ? {
                borderColor: 'var(--color-accent-primary)',
                background: 'var(--color-accent-primary-subtle)',
              }
            : {}
        }
      >
        <ImageIcon size={24} />
        <span className={styles.imageUploadText}>
          Click to upload or drag and drop
        </span>
        <span className={styles.imageUploadHint}>
          PNG, JPG, GIF, SVG, WEBP
        </span>
        <button
          className={styles.codeCopyBtn}
          onClick={(e) => {
            e.stopPropagation();
            handleUrlEmbed();
          }}
          style={{ marginTop: '4px' }}
        >
          Or paste a URL
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}
