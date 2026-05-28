'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link2,
  Highlighter,
} from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * BlockToolbar — floating format toolbar that appears on text selection.
 * Executes document.execCommand for rich text formatting.
 */
export default function BlockToolbar({ position, onClose }) {
  const toolbarRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        // Don't close immediately — allow selection to remain
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const exec = useCallback((command, value = null) => {
    document.execCommand(command, false, value);
  }, []);

  const isActive = useCallback((command) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }, []);

  const handleLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      exec('createLink', url);
    }
  }, [exec]);

  const handleHighlight = useCallback(() => {
    exec('hiliteColor', 'rgba(99, 102, 241, 0.25)');
  }, [exec]);

  const formatButtons = [
    {
      icon: <Bold size={15} />,
      command: 'bold',
      label: 'Bold (Ctrl+B)',
    },
    {
      icon: <Italic size={15} />,
      command: 'italic',
      label: 'Italic (Ctrl+I)',
    },
    {
      icon: <Underline size={15} />,
      command: 'underline',
      label: 'Underline (Ctrl+U)',
    },
    {
      icon: <Strikethrough size={15} />,
      command: 'strikethrough',
      label: 'Strikethrough',
    },
    null, // divider
    {
      icon: <Code size={15} />,
      command: 'code',
      label: 'Inline code',
      custom: () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const text = range.toString();
          if (text) {
            const code = document.createElement('code');
            code.style.background = 'var(--color-bg-tertiary)';
            code.style.padding = '2px 6px';
            code.style.borderRadius = '4px';
            code.style.fontFamily = 'var(--font-mono)';
            code.style.fontSize = '0.875em';
            code.textContent = text;
            range.deleteContents();
            range.insertNode(code);
          }
        }
      },
    },
    {
      icon: <Link2 size={15} />,
      command: 'link',
      label: 'Add link',
      custom: handleLink,
    },
    {
      icon: <Highlighter size={15} />,
      command: 'highlight',
      label: 'Highlight',
      custom: handleHighlight,
    },
  ];

  if (!position) return null;

  return (
    <div
      ref={toolbarRef}
      className={styles.toolbar}
      style={{
        top: position.top - 48,
        left: position.left,
      }}
    >
      {formatButtons.map((btn, i) => {
        if (!btn) {
          return <div key={`div-${i}`} className={styles.toolbarDivider} />;
        }

        return (
          <button
            key={btn.command}
            className={`${styles.toolbarBtn} ${
              isActive(btn.command) ? styles.toolbarBtnActive : ''
            }`}
            title={btn.label}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent losing selection
              if (btn.custom) {
                btn.custom();
              } else {
                exec(btn.command);
              }
            }}
          >
            {btn.icon}
          </button>
        );
      })}
    </div>
  );
}
