'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

export default function DeliveriesPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [bookingId, setBookingId] = useState('');
  const [fileName, setFileName] = useState('edited-gallery.zip');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken || !bookingId) {
      return;
    }

    setSubmitting(true);
    try {
      await apiPost(
        '/media/upload',
        {
          fileName,
          mimeType: 'application/zip',
          folder: `snapmatch/deliveries/${bookingId}`
        },
        session.user.accessToken
      );

      showToast('Delivery upload signature generated');
    } catch (error) {
      console.error(error);
      showToast('Unable to generate upload signature', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Deliveries</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Prepare delivery upload</h2>
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <input value={bookingId} onChange={(e) => setBookingId(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Booking UUID" />
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Archive filename" />
          <button disabled={submitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? 'Generating...' : 'Generate upload URL'}
          </button>
        </form>
      </section>
    </div>
  );
}
