'use client';

import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface DisputeItem {
  id: string;
  status: string;
  reason: string;
  details?: string;
  aiSummary?: string;
  aiSuggestedResolution?: string;
  suggestedRefundPct?: string;
  booking?: { id: string; title: string };
}

export default function AdminDisputesPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [resolutionNotes, setResolutionNotes] = useState('Approved partial refund after review.');
  const [refundPercent, setRefundPercent] = useState(40);

  const { data, refetch } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () => apiGet<DisputeItem[]>('/disputes', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  async function resolveDispute(event: FormEvent<HTMLFormElement>, disputeId: string): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost(
      `/disputes/${disputeId}/resolve`,
      {
        resolutionNotes,
        refundPercent
      },
      session.user.accessToken
    );

    showToast('Dispute resolved');
    await refetch();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Disputes</h1>
      <div className="space-y-4">
        {(data ?? []).map((item) => (
          <section key={item.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm"><strong>Status:</strong> {item.status}</p>
            <p className="text-sm"><strong>Reason:</strong> {item.reason}</p>
            <p className="text-sm"><strong>Booking:</strong> {item.booking?.title || item.booking?.id}</p>
            {item.aiSummary ? <p className="mt-2 text-sm"><strong>AI Summary:</strong> {item.aiSummary}</p> : null}
            {item.aiSuggestedResolution ? <p className="text-sm"><strong>AI Suggestion:</strong> {item.aiSuggestedResolution}</p> : null}
            {item.suggestedRefundPct ? <p className="text-sm"><strong>AI Refund %:</strong> {item.suggestedRefundPct}</p> : null}

            {item.status !== 'RESOLVED' ? (
              <form onSubmit={(e) => resolveDispute(e, item.id)} className="mt-3 space-y-2">
                <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" />
                <input type="number" value={refundPercent} min={0} max={100} onChange={(e) => setRefundPercent(Number(e.target.value))} className="w-full rounded-md border px-3 py-2 text-sm" />
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Resolve</button>
              </form>
            ) : null}
          </section>
        ))}
        {(data ?? []).length === 0 ? <p className="text-sm text-slate-600">No disputes.</p> : null}
      </div>
    </div>
  );
}
