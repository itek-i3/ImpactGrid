// Every form in the app marks an invalid field the same way: an `error`
// class and `aria-invalid="true"` on the input/select/textarea. Call this
// right after setting the error state (and switching step/tab/section if the
// field lives behind one) so the user is actually taken to the field instead
// of just seeing it flash red somewhere off-screen.
//
// Deferred one frame so it runs after React has committed the error class
// (and any step/section switch) to the DOM.
export function focusFirstError(root) {
  if (typeof window === 'undefined') return;
  requestAnimationFrame(() => {
    const scope = (root && 'current' in root ? root.current : root) || document;
    const el = scope?.querySelector?.('.error, [aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (typeof el.focus === 'function' ? el : el.querySelector('input, textarea, select'))?.focus?.();
  });
}
