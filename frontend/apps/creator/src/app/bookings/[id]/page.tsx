'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { createRealtimeSocket } from '@/lib/realtime';
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
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; content: string; senderId: string }>>([]);
  const [customerTyping, setCustomerTyping] = useState(false);
  const socketRef = useRef<ReturnType<typeof createRealtimeSocket> | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ['creator-booking', bookingId],
    queryFn: () => apiGet<BookingDetails>(`/bookings/${bookingId}`, session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken && bookingId)
  });

  useEffect(() => {
    if (!session?.user?.accessToken || !bookingId) {
      return;
    }

    const socket = createRealtimeSocket(session.user.accessToken);
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('chat:join', { roomType: 'booking', roomId: bookingId });
    });

    socket.on('chat:history', (payload: { roomType: string; roomId: string; messages: Array<{ id: string; content: string; senderId: string }> }) => {
      if (payload.roomType === 'booking' && payload.roomId === bookingId) {
        setChatMessages(payload.messages);
      }
    });

    socket.on('chat:new', (payload: { roomType: string; roomId: string; message: { id: string; content: string; senderId: string } }) => {
      if (payload.roomType === 'booking' && payload.roomId === bookingId) {
        setChatMessages((current) => [...current, payload.message].slice(-100));
      }
    });
    socket.on('chat:typing', (payload: { roomType: string; roomId: string; userId: string; typing: boolean }) => {
      if (payload.roomType === 'booking' && payload.roomId === bookingId && payload.userId !== session.user.id) {
        setCustomerTyping(payload.typing);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.user?.accessToken, bookingId, session?.user?.id]);

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

  async function registerUploadedMedia(): Promise<void> {
    if (!session?.user?.accessToken || !uploadedUrl.trim() || !files?.[0]) {
      return;
    }

    await apiPost(
      '/media/assets',
      {
        bookingId,
        fileName: files[0].name,
        mimeType: files[0].type || 'image/jpeg',
        sizeBytes: files[0].size || 1,
        originalUrl: uploadedUrl.trim()
      },
      session.user.accessToken
    );

    showToast('Media registered and queued for AI analysis');
    setUploadedUrl('');
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

  function sendChat(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!session?.user?.accessToken || !chatInput.trim()) {
      return;
    }

    socketRef.current?.emit(
        'chat:send',
        { roomType: 'booking', roomId: bookingId, message: chatInput.trim() },
        (result: { ok: boolean; error?: string }) => {
          if (result.ok) {
            setChatInput('');
            socketRef.current?.emit('chat:typing', { roomType: 'booking', roomId: bookingId, typing: false });
          } else {
            showToast(result.error ?? 'Unable to send message', 'error');
          }
        }
      );
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
        <div className="mt-4 space-y-2">
          <input
            value={uploadedUrl}
            onChange={(e) => setUploadedUrl(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Paste uploaded Cloudinary URL"
          />
          <button onClick={registerUploadedMedia} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
            Register uploaded media
          </button>
        </div>
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

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Chat with Customer</h2>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded border p-3 text-sm">
          {chatMessages.map((msg) => (
            <p key={msg.id}>
              <strong>{msg.senderId === session?.user?.id ? 'You' : 'Customer'}:</strong> {msg.content}
            </p>
          ))}
          {chatMessages.length === 0 ? <p className="text-slate-600">No messages yet.</p> : null}
        </div>
        <form onSubmit={sendChat} className="mt-3 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => {
              setChatInput(e.target.value);
              socketRef.current?.emit('chat:typing', { roomType: 'booking', roomId: bookingId, typing: e.target.value.length > 0 });
            }}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Type message"
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Send</button>
        </form>
        {customerTyping ? <p className="mt-2 text-xs text-slate-500">Customer is typing...</p> : null}
      </section>
    </div>
  );
}
