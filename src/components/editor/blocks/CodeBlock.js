'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import styles from '@/styles/editor.module.css';

const languages = [
  'plain', 'javascript', 'typescript', 'python', 'html', 'css',
  'json', 'sql', 'bash', 'java', 'c', 'cpp', 'go', 'rust',
  'ruby', 'php', 'swift', 'kotlin', 'dart', 'yaml', 'markdown',
];

/**
 * CodeBlock — code editor with language selector and copy button.
 */
export default function CodeBlock({ block, onUpdate, readOnly = false }) {
  const [copied, setCopied] = useState(false);
  const language = block.properties?.language || 'javascript';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.content?.text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Fallback
    }
  };

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <select
          className={styles.codeLangSelect}
          value={language}
          disabled={readOnly}
          onChange={(e) =>
            onUpdate({
              properties: { ...block.properties, language: e.target.value },
            })
          }
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        <button className={styles.codeCopyBtn} onClick={handleCopy}>
          {copied ? (
            <>
              <Check size={12} /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </div>

      <textarea
        className={styles.codeContent}
        value={block.content?.text || ''}
        onChange={(e) => !readOnly && onUpdate({ content: { text: e.target.value } })}
        readOnly={readOnly}
        placeholder={readOnly ? '' : '// Write your code here...'}
        spellCheck={false}
        rows={4}
      />
    </div>
  );
}
