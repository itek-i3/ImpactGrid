import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const ext = file.name.split('.').pop();
  const path = `${user.id}/avatar.${ext}`;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const admin = createAdminClient();

  // Ensure bucket exists
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === 'avatars');
  if (!bucketExists) {
    await admin.storage.createBucket('avatars', { public: true });
  }

  const { error } = await admin.storage.from('avatars').upload(path, buffer, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });

  if (error) {
    console.error('Storage upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  await admin.from('profiles').update({ avatar_url: url }).eq('id', user.id);

  return NextResponse.json({ url });
}
