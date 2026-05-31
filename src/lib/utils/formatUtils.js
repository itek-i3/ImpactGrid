/**
 * Format utility functions for ImpactNotion.
 * Number formatting, currency, file sizes, truncation, and data helpers.
 */

/**
 * Format a number with locale-aware separators.
 * @param {number} value
 * @param {object} options - Intl.NumberFormat options
 * @returns {string}
 */
export function formatNumber(value, options = {}) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US', options);
}

/**
 * Format a number as currency.
 * @param {number} value
 * @param {string} currency - ISO currency code (default: 'USD')
 * @returns {string}
 */
export function formatCurrency(value, currency = 'USD') {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a number as a compact representation (e.g., 1.2K, 3.5M).
 * @param {number} value
 * @returns {string}
 */
export function formatCompact(value) {
  if (value == null || isNaN(value)) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Format a percentage value.
 * @param {number} value - Value between 0 and 1 (or 0 and 100 if isWhole=true)
 * @param {boolean} isWhole - If true, treats value as already a percentage
 * @returns {string}
 */
export function formatPercent(value, isWhole = false) {
  if (value == null || isNaN(value)) return '—';
  const pct = isWhole ? Number(value) : Number(value) * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Format file size in human-readable form.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Truncate a string to a maximum length with ellipsis.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Convert a string to title case.
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

/**
 * Generate initials from a name (e.g., "John Doe" → "JD").
 * @param {string} name
 * @param {number} maxChars
 * @returns {string}
 */
export function getInitials(name, maxChars = 2) {
  if (!name) return '';
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, maxChars)
    .join('');
}

/**
 * Slugify a string for URL-safe use.
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Pluralize a word based on count.
 * @param {number} count
 * @param {string} singular
 * @param {string} plural - Optional custom plural form
 * @returns {string}
 */
export function pluralize(count, singular, plural = null) {
  const p = plural || `${singular}s`;
  return `${formatNumber(count)} ${count === 1 ? singular : p}`;
}

/**
 * Deep-clone a JSON-safe object.
 * @param {*} obj
 * @returns {*}
 */
export function deepClone(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delay - Milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Generate a deterministic color from a string (for avatars, tags, etc.).
 * @param {string} str
 * @returns {string} - HSL color string
 */
export function stringToColor(str) {
  if (!str) return 'hsl(0, 0%, 60%)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}
