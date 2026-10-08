// Keeps public/pdf.worker.min.mjs in sync with the installed pdfjs-dist
// version — the editor's PDF import (src/lib/utils/fileToBlocks.js) points
// pdfjs's GlobalWorkerOptions.workerSrc at this static copy instead of a
// bundler asset import, since pdfjs requires the worker build to exactly
// match the main library's version. Re-run automatically on every
// `npm install` via the postinstall script.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const dest = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs');

if (!fs.existsSync(src)) {
  console.warn('[copy-pdf-worker] pdfjs-dist worker build not found at', src, '— skipping.');
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log('[copy-pdf-worker] copied pdf.worker.min.mjs to public/');
