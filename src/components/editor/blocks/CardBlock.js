'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from '@/styles/editor.module.css';

const CARD_ACCENTS = ['#306CEC', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export default function CardBlock({ block, onUpdate, readOnly = false }) {
  const icon = block.content?.icon || '🌐';
  const title = block.content?.title || '';
  const description = block.content?.description || '';
  const fullContent = block.content?.fullContent || '';
  const accent = block.content?.accent || CARD_ACCENTS[0];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  const iconInputRef = useRef(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const fullRef = useRef(null);

  // Sync contentEditable from props
  useEffect(() => {
    if (titleRef.current && titleRef.current.innerText !== title)
      titleRef.current.innerText = title;
  }, [title]);

  useEffect(() => {
    if (descRef.current && descRef.current.innerText !== description)
      descRef.current.innerText = description;
  }, [description]);

  useEffect(() => {
    if (fullRef.current && fullRef.current.innerText !== fullContent)
      fullRef.current.innerText = fullContent;
  }, [fullContent]);

  useEffect(() => {
    if (editingIcon && iconInputRef.current) {
      iconInputRef.current.focus();
      iconInputRef.current.select();
    }
  }, [editingIcon]);

  function cycleAccent() {
    if (readOnly) return;
    const idx = CARD_ACCENTS.indexOf(accent);
    const next = CARD_ACCENTS[(idx + 1) % CARD_ACCENTS.length];
    onUpdate({ content: { ...block.content, accent: next } });
  }

  return (
    <>
      <div
        className={styles.cardBlock}
        style={{ borderLeftColor: accent }}
      >
        {/* Accent dot — click to cycle color */}
        {!readOnly && (
          <div
            className={styles.cardAccentDot}
            style={{ background: accent }}
            onClick={cycleAccent}
            title="Click to change color"
          />
        )}

        {/* Icon */}
        <div className={styles.cardIconWrap}>
          {editingIcon && !readOnly ? (
            <input
              ref={iconInputRef}
              className={styles.cardIconInput}
              defaultValue={icon}
              maxLength={2}
              onBlur={(e) => {
                setEditingIcon(false);
                const val = e.target.value.trim() || '🌐';
                onUpdate({ content: { ...block.content, icon: val } });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  iconInputRef.current?.blur();
                }
              }}
            />
          ) : (
            <span
              className={styles.cardIcon}
              onClick={() => !readOnly && setEditingIcon(true)}
              title={readOnly ? undefined : 'Click to change icon'}
            >
              {icon}
            </span>
          )}
        </div>

        {/* Title */}
        <div
          ref={titleRef}
          className={styles.cardTitle}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          data-placeholder="Card title..."
          onBlur={(e) => onUpdate({ content: { ...block.content, title: e.target.innerText } })}
        />

        {/* Description */}
        <div
          ref={descRef}
          className={styles.cardDescription}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          data-placeholder="Short description..."
          onBlur={(e) => onUpdate({ content: { ...block.content, description: e.target.innerText } })}
        />

        {/* View button */}
        <button
          className={styles.cardViewBtn}
          style={{ color: accent }}
          onClick={() => setModalOpen(true)}
        >
          View Full {title || 'Details'} →
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className={styles.cardModalOverlay} onClick={() => setModalOpen(false)}>
          <div
            className={styles.cardModal}
            style={{ borderTopColor: accent }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.cardModalHeader}>
              <span className={styles.cardModalIcon}>{icon}</span>
              <h2 className={styles.cardModalTitle}>{title || 'Details'}</h2>
              <button className={styles.cardModalClose} onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div
              ref={fullRef}
              className={styles.cardModalBody}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              data-placeholder="Write the full details here..."
              onBlur={(e) =>
                !readOnly &&
                onUpdate({ content: { ...block.content, fullContent: e.target.innerText } })
              }
            />
          </div>
        </div>
      )}
    </>
  );
}
