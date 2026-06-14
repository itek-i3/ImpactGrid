'use client';

import { Suspense, useState, useEffect } from 'react';
import { ChatClient } from './ChatClient';

function ChatWithParams() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <ChatClient />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatWithParams />
    </Suspense>
  );
}
