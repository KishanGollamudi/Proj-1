'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface BookingDetails {
  id: string;
  title: string;
  status: string;
  eventDate: string;
  customer?: { fullName: string; email: string };
}

export default function CreatorBookingManagementPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [files, setFiles] = useState<FileList | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['creator-booking', bookingId],
    queryFn: () => apiGet<BookingDetails>(`/bookings/${bookingId}`, session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken && bookingId)
  });

  async function uploadMedia(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken || !files?.[0]) {
      return;
    }

    await apiPost(
      '/media/upload',
      {
        fileName: files[0].name,
        mimeType: files[0].type || 'image/jpeg',
        folder: `snapmatch/bookings/${bookingId}`
      },
      session.user.accessToken
    );

    showToast('Upload signature generated. Direct upload integration ready.');
  }

  async function cancelBooking(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    setCanceling(true);
    try {
      await apiPut(`/bookings/${bookingId}/cancel`, { reason: cancelReason || undefined }, session.user.accessToken);
      showToast('Booking canceled');
      setCancelReason('');
      await refetch();
    } catch (error) {
      console.error(error);
      showToast('Unable to cancel booking', 'error');
    } finally {
      setCanceling(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Booking Management</h1>
        {data ? (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p><strong>Title:</strong> {data.title}</p>
            <p><strong>Status:</strong> {data.status}</p>
            <p><strong>Date:</strong> {new Date(data.eventDate).toLocaleString()}</p>
            <p><strong>Client:</strong> {data.customer?.fullName || '-'} ({data.customer?.email || '-'})</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Loading booking...</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Upload media</h2>
        <form onSubmit={uploadMedia} className="mt-3 space-y-3">
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="w-full rounded-md border p-2 text-sm" />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Generate Upload URL</button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Cancel booking</h2>
        <form onSubmit={cancelBooking} className="mt-3 space-y-3">
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Reason (optional)"
          />
          <button disabled={canceling || data?.status === 'CANCELED' || data?.status === 'COMPLETED'} className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {canceling ? 'Canceling...' : 'Cancel booking'}
          </button>
        </form>
      </section>
    </div>
  );
}
