'use client';

import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet, apiPut } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface Settings {
  commissionPercent: number;
  surgeParams: Record<string, unknown>;
  emailTemplates: Record<string, unknown>;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiGet<Settings>('/admin/settings', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  const [commissionPercent, setCommissionPercent] = useState(15);
  const [surgeParams, setSurgeParams] = useState('{"base":1,"peakHourBoost":1.2}');
  const [emailTemplates, setEmailTemplates] = useState('{"bookingConfirmed":"Default template"}');

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPut(
      '/admin/settings',
      {
        commissionPercent,
        surgeParams: JSON.parse(surgeParams),
        emailTemplates: JSON.parse(emailTemplates)
      },
      session.user.accessToken
    );

    showToast('Settings saved');
    await query.refetch();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <form onSubmit={save} className="space-y-3">
          <input type="number" value={commissionPercent} onChange={(e) => setCommissionPercent(Number(e.target.value))} className="w-full rounded border px-3 py-2 text-sm" placeholder="Commission %" />
          <textarea value={surgeParams} onChange={(e) => setSurgeParams(e.target.value)} rows={4} className="w-full rounded border px-3 py-2 text-sm" />
          <textarea value={emailTemplates} onChange={(e) => setEmailTemplates(e.target.value)} rows={4} className="w-full rounded border px-3 py-2 text-sm" />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </section>
    </div>
  );
}
