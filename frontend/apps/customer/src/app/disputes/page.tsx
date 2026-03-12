'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

export default function CustomerDisputesPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [bookingId, setBookingId] = useState('');
  const [reason, setReason] = useState('Creator no-show');
  const [details, setDetails] = useState('The creator did not arrive at the scheduled time and did not respond.');

  async function fileDispute(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost('/disputes', { bookingId, reason, details }, session.user.accessToken);
    showToast('Dispute filed successfully');
    setBookingId('');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">File a Dispute</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <form onSubmit={fileDispute} className="space-y-3">
          <input value={bookingId} onChange={(e) => setBookingId(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Booking UUID" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Reason" />
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Details" />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Submit Dispute</button>
        </form>
      </section>
    </div>
  );
}
