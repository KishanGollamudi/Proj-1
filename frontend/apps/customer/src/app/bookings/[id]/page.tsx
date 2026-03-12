'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { createRealtimeSocket } from '@/lib/realtime';
import { EditorSelector, useToast } from '@snapmatch/shared';

interface BookingDetails {
  id: string;
  status: string;
  title: string;
  eventDate: string;
  cancellationReason?: string | null;
  location?: string | null;
  creator?: { fullName: string };
  mediaAssets?: Array<{
    id: string;
    fileName: string;
    originalUrl: string;
    mimeType: string;
    status: string;
  }>;
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    reviewer?: { fullName: string };
  }>;
}

interface CreatedEditorTask {
  id: string;
  statusLabel: string;
  estimatedPrice: string;
  suggestedEditors: Array<{
    id: string;
    fullName: string;
    hourlyRate: number;
    score: number;
    reasons: string[];
  }>;
}

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  const [hireOpen, setHireOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [stylePreference, setStylePreference] = useState('Cinematic');
  const [description, setDescription] = useState('Please color grade and retouch key shots.');
  const [paymentMethodId, setPaymentMethodId] = useState('pm_card_visa');
  const [creatingTask, setCreatingTask] = useState(false);
  const [createdTask, setCreatedTask] = useState<CreatedEditorTask | null>(null);
  const [bookingChatInput, setBookingChatInput] = useState('');
  const [bookingChatMessages, setBookingChatMessages] = useState<Array<{ id: string; content: string; senderId: string }>>([]);
  const [creatorTyping, setCreatorTyping] = useState(false);
  const socketRef = useRef<ReturnType<typeof createRealtimeSocket> | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiGet<BookingDetails>(`/bookings/${bookingId}`, session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken && bookingId)
  });

  const canHireEditor = useMemo(() => {
    if (!data?.eventDate) {
      return false;
    }
    return new Date(data.eventDate).getTime() <= Date.now();
  }, [data?.eventDate]);

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
        setBookingChatMessages(payload.messages);
      }
    });

    socket.on('chat:new', (payload: { roomType: string; roomId: string; message: { id: string; content: string; senderId: string } }) => {
      if (payload.roomType === 'booking' && payload.roomId === bookingId) {
        setBookingChatMessages((current) => [...current, payload.message].slice(-100));
      }
    });
    socket.on('chat:typing', (payload: { roomType: string; roomId: string; userId: string; typing: boolean }) => {
      if (payload.roomType === 'booking' && payload.roomId === bookingId && payload.userId !== session.user.id) {
        setCreatorTyping(payload.typing);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.user?.accessToken, bookingId, session?.user?.id]);

  async function onCancel(event: FormEvent<HTMLFormElement>): Promise<void> {
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

  function toggleMediaAsset(mediaId: string): void {
    setSelectedMedia((current) =>
      current.includes(mediaId) ? current.filter((id) => id !== mediaId) : [...current, mediaId]
    );
  }

  async function onCreateEditorTask(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken || selectedMedia.length === 0) {
      return;
    }

    setCreatingTask(true);
    try {
      const task = await apiPost<CreatedEditorTask>(
        '/editor-tasks',
        {
          bookingId,
          mediaAssetIds: selectedMedia,
          stylePreference,
          description,
          paymentMethodId
        },
        session.user.accessToken,
        { 'Idempotency-Key': `editor-task-${bookingId}-${Date.now()}` }
      );

      setCreatedTask(task);
      showToast('Editor task created and escrow funded');
    } catch (error) {
      console.error(error);
      showToast('Failed to create editor task', 'error');
    } finally {
      setCreatingTask(false);
    }
  }

  function sendBookingChat(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!session?.user?.accessToken || !bookingChatInput.trim()) {
      return;
    }

    socketRef.current?.emit(
        'chat:send',
        { roomType: 'booking', roomId: bookingId, message: bookingChatInput.trim() },
        (result: { ok: boolean; error?: string }) => {
          if (result.ok) {
            setBookingChatInput('');
            socketRef.current?.emit('chat:typing', { roomType: 'booking', roomId: bookingId, typing: false });
          } else {
            showToast(result.error ?? 'Unable to send chat', 'error');
          }
        }
      );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Booking Details</h1>
          <button
            type="button"
            disabled={!canHireEditor || data?.status === 'CANCELED'}
            onClick={() => setHireOpen((value) => !value)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Hire Editor
          </button>
        </div>
        {data ? (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p><strong>Title:</strong> {data.title}</p>
            <p><strong>Status:</strong> {data.status}</p>
            <p><strong>Date:</strong> {new Date(data.eventDate).toLocaleString()}</p>
            <p><strong>Creator:</strong> {data.creator?.fullName || '-'}</p>
            <p><strong>Location:</strong> {data.location || '-'}</p>
            {data.cancellationReason ? <p><strong>Cancel reason:</strong> {data.cancellationReason}</p> : null}
            {!canHireEditor ? <p className="text-xs text-slate-500">Editor tasks can be created after the event time.</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Loading booking details...</p>
        )}
      </section>

      {hireOpen ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Hire Editor</h2>
          <form onSubmit={onCreateEditorTask} className="mt-3 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {(data?.mediaAssets ?? []).map((asset) => (
                <label key={asset.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedMedia.includes(asset.id)}
                    onChange={() => toggleMediaAsset(asset.id)}
                  />
                  <span className="truncate">{asset.fileName}</span>
                </label>
              ))}
            </div>
            <select value={stylePreference} onChange={(event) => setStylePreference(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="Cinematic">Cinematic</option>
              <option value="Natural">Natural</option>
              <option value="High Contrast">High Contrast</option>
              <option value="Fashion Retouch">Fashion Retouch</option>
            </select>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Describe the expected edit output"
            />
            <input
              value={paymentMethodId}
              onChange={(event) => setPaymentMethodId(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Payment method id"
            />
            <button disabled={creatingTask || selectedMedia.length === 0} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creatingTask ? 'Creating...' : 'Create Editor Task'}
            </button>
          </form>

          {createdTask ? (
            <div className="mt-5 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold">Task #{createdTask.id} created</p>
              <p className="text-sm text-slate-700">Status: {createdTask.statusLabel}</p>
              <p className="text-sm text-slate-700">Estimated: ${Number(createdTask.estimatedPrice).toFixed(2)}</p>
              <EditorSelector editors={createdTask.suggestedEditors} />
              <Link href={`/editor-tasks/${createdTask.id}`} className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">
                Open Task
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Media Gallery</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(data?.mediaAssets ?? []).map((asset) => (
            <img
              key={asset.id}
              src={asset.originalUrl}
              alt={asset.fileName}
              className="rounded-md object-cover"
              loading="lazy"
              decoding="async"
            />
          ))}
          {(data?.mediaAssets ?? []).length === 0 ? (
            <p className="col-span-4 text-sm text-slate-600">No uploaded media found for this booking.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Chat with Creator</h2>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded border p-3 text-sm">
          {bookingChatMessages.map((msg) => (
            <p key={msg.id}>
              <strong>{msg.senderId === session?.user?.id ? 'You' : 'Creator'}:</strong> {msg.content}
            </p>
          ))}
          {bookingChatMessages.length === 0 ? <p className="text-slate-600">No messages yet.</p> : null}
        </div>
        <form onSubmit={sendBookingChat} className="mt-3 flex gap-2">
          <input
            value={bookingChatInput}
            onChange={(e) => {
              setBookingChatInput(e.target.value);
              socketRef.current?.emit('chat:typing', { roomType: 'booking', roomId: bookingId, typing: e.target.value.length > 0 });
            }}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Type message"
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Send</button>
        </form>
        {creatorTyping ? <p className="mt-2 text-xs text-slate-500">Creator is typing...</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Cancellation</h2>
        <form onSubmit={onCancel} className="mt-3 space-y-3">
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Reason (optional)" />
          <button disabled={canceling || data?.status === 'CANCELED' || data?.status === 'COMPLETED'} className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {canceling ? 'Canceling...' : 'Cancel Booking'}
          </button>
          <p className="text-xs text-slate-600">Canceled and completed bookings cannot be canceled again.</p>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Reviews</h2>
        <div className="mt-3 space-y-3">
          {(data?.reviews ?? []).map((item) => (
            <article key={item.id} className="rounded border p-3">
              <p className="text-sm font-medium">{item.reviewer?.fullName || 'Reviewer'} • {item.rating}/5</p>
              <p className="mt-1 text-sm text-slate-700">{item.comment || 'No comment provided.'}</p>
            </article>
          ))}
          {(data?.reviews ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No reviews yet for this booking.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
