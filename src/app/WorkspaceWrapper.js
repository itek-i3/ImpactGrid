'use client';

import { Suspense, useState, useEffect } from 'react';
import WorkspaceClient from './WorkspaceClient';

function WorkspaceWithParams() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <WorkspaceClient />;
}

export default function WorkspaceWrapper() {
  return (
    <Suspense fallback={null}>
      <WorkspaceWithParams />
    </Suspense>
  );
}
