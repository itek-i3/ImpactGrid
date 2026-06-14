'use client';

import { useState, useEffect } from 'react';
import WorkspaceClient from './WorkspaceClient';

export default function WorkspaceWrapper() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <WorkspaceClient />;
}
