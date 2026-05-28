'use client';

import { forwardRef } from 'react';
import styles from '@/styles/components.module.css';

/**
 * Input component with label, help text, and error state.
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    help,
    className = '',
    ...props
  },
  ref
) {
  return (
    <div className={styles.inputWrapper}>
      {label && <label className={styles.inputLabel}>{label}</label>}
      <input
        ref={ref}
        className={`${styles.input} ${error ? styles.inputError : ''} ${className}`}
        {...props}
      />
      {help && !error && <span className={styles.inputHelp}>{help}</span>}
      {error && <span className={styles.inputErrorMsg}>{error}</span>}
    </div>
  );
});

export default Input;
