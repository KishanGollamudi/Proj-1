'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

export default function AdminFinancePage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('Manual refund requested');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/payments/refund', { bookingId, amount, reason }, session.user.accessToken);
      showToast('Refund submitted');
    } catch (error) {
      console.error(error);
      showToast('Refund failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Finance</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Issue refund</h2>
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <input value={bookingId} onChange={(e) => setBookingId(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Booking UUID" />
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={0.01} step="0.01" required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Amount" />
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Refund reason" />
          <button disabled={submitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? 'Submitting...' : 'Submit refund'}
          </button>
        </form>
      </section>
    </div>
  );
}
