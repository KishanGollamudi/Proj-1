'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { apiGet, apiPut } from '@/lib/api';
import { createRealtimeSocket } from '@/lib/realtime';
import { useToast } from '@snapmatch/shared';

interface EditorTask {
  id: string;
  statusLabel: string;
  stylePreference?: string;
  description?: string;
  revisionNotes?: string;
  submittedMediaUrls: string[];
  mediaAssetIds: string[];
  customer?: { fullName?: string | null; email?: string | null } | null;
  estimatedPrice?: string;
}

export default function EditorTaskDetailsPage() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [deliverables, setDeliverables] = useState('https://example.com/edited/delivery-1.jpg');
  const [notes, setNotes] = useState('Primary pass complete with requested style.');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; message: string; senderRole: string; createdAt: string }>
  >([]);

  const { data, refetch } = useQuery({
    queryKey: ['editor-task-details', taskId],
    queryFn: () => apiGet<EditorTask>(`/editor-tasks/${taskId}`, session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken && taskId)
  });

  useEffect(() => {
    if (!session?.user?.accessToken || !taskId) {
      return;
    }

    const socket = createRealtimeSocket(session.user.accessToken);

    socket.on('connect', () => {
      socket.emit('task:join', { taskId });
    });

    socket.on('task:update', (payload: { taskId: string; event: string }) => {
      if (payload.taskId !== taskId) {
        return;
      }
      refetch();
      showToast(`Task update: ${payload.event}`);
    });

    socket.on('task:chat:history', (payload: { taskId: string; messages: Array<{ id: string; message: string; senderRole: string; createdAt: string }> }) => {
      if (payload.taskId !== taskId) {
        return;
      }
      setChatMessages(payload.messages);
    });

    socket.on('task:chat:new', (message: { id: string; taskId: string; message: string; senderRole: string; createdAt: string }) => {
      if (message.taskId !== taskId) {
        return;
      }
      setChatMessages((current) => [...current, message].slice(-100));
    });

    return () => {
      socket.disconnect();
    };
  }, [session?.user?.accessToken, taskId, refetch, showToast]);

  async function acceptTask(): Promise<void> {
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPut(`/editor-tasks/${taskId}/assign`, {}, session.user.accessToken);
    showToast('Task accepted');
    await refetch();
  }

  async function submitTask(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    const urls = deliverables
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      showToast('Provide at least one file URL', 'error');
      return;
    }

    await apiPut(
      `/editor-tasks/${taskId}/submit`,
      {
        submittedMediaUrls: urls,
        notes
      },
      session.user.accessToken
    );

    showToast('Submission sent to customer review');
    await refetch();
  }

  function sendChatMessage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!session?.user?.accessToken || !taskId || !chatInput.trim()) {
      return;
    }

    const socket = createRealtimeSocket(session.user.accessToken);
    socket.on('connect', () => {
      socket.emit('task:join', { taskId });
      socket.emit(
        'task:chat:send',
        { taskId, message: chatInput.trim() },
        (result: { ok: boolean; error?: string }) => {
          if (!result.ok) {
            showToast(result.error ?? 'Failed to send message', 'error');
          } else {
            setChatInput('');
          }
          socket.disconnect();
        }
      );
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Task Details</h1>
        {data ? (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p><strong>Status:</strong> {data.statusLabel}</p>
            <p><strong>Style:</strong> {data.stylePreference || '-'}</p>
            <p><strong>Estimated payout:</strong> ${Number(data.estimatedPrice ?? 0).toFixed(2)}</p>
            <p><strong>Customer:</strong> {data.customer?.fullName || '-'}</p>
            <p><strong>Media asset count:</strong> {data.mediaAssetIds.length}</p>
            {data.revisionNotes ? <p><strong>Revision notes:</strong> {data.revisionNotes}</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Loading task details...</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={acceptTask}
            disabled={data?.statusLabel !== 'pending'}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Accept Task
          </button>
        </div>

        <form onSubmit={submitTask} className="mt-4 space-y-3">
          <textarea
            value={deliverables}
            onChange={(event) => setDeliverables(event.target.value)}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="One URL per line"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Submission notes"
          />
          <button
            disabled={data?.statusLabel !== 'assigned' && data?.statusLabel !== 'changes_requested'}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Submit Edited Work
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Chat with Customer</h2>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded border p-3 text-sm">
          {chatMessages.map((msg) => (
            <p key={msg.id}>
              <strong>{msg.senderRole}:</strong> {msg.message}
            </p>
          ))}
          {chatMessages.length === 0 ? <p className="text-slate-600">No messages yet.</p> : null}
        </div>
        <form onSubmit={sendChatMessage} className="mt-3 flex gap-2">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Type message"
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
