'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiGet, apiPut } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface Profile {
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState('');

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      if (!session?.user?.accessToken) {
        return;
      }
      const data = await apiGet<Profile>('/users/profile', session.user.accessToken);
      setName(data.fullName || '');
      setPhone(data.phone || '');
      setProfileImage(data.avatarUrl || '');
    }

    loadProfile().catch(console.error);
  }, [session?.user?.accessToken]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }
    await apiPut('/users/profile', { name, phone, profileImage }, session.user.accessToken);
    showToast('Profile updated');
  }

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Name" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Phone" />
        <input value={profileImage} onChange={(e) => setProfileImage(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Profile image URL" />
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save Profile</button>
      </form>
    </div>
  );
}
