'use client';

import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';

export default function FloatingChat() {
  const router = useRouter();
  const { workspace } = useWorkspaceStore();

  return (
    <button
      onClick={() => router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`)}
      title="Open team chat"
      style={{
        position: 'fixed', bottom: 28, right: 28,
        width: 52, height: 52, borderRadius: '50%',
        background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(48,108,236,0.55)',
        zIndex: 9990, color: '#fff', transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(48,108,236,0.70)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(48,108,236,0.55)'; }}
    >
      <MessageSquare size={22} />
    </button>
  );
}
