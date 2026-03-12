'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost } from '@/lib/api';
import { createRealtimeSocket } from '@/lib/realtime';
import { useToast } from '@snapmatch/shared';

interface EditorTask {
  id: string;
  statusLabel: string;
  stylePreference?: string;
  description?: string;
  revisionNotes?: string;
  submittedMediaUrls: string[];
  estimatedPrice?: string;
  editor?: { fullName?: string | null; email?: string | null } | null;
}

export default function CustomerEditorTaskDetailsPage() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [revisionNotes, setRevisionNotes] = useState('Please adjust skin tones and reduce highlights.');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; message: string; senderRole: string; createdAt: string }>
  >([]);

  const { data, refetch } = useQuery({
    queryKey: ['customer-editor-task', taskId],
    queryFn: () => apiGet<EditorTask>(`/editor-tasks/${taskId}`, session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken && taskId)
  });

  const canChat = useMemo(() => Boolean(data?.editor?.fullName), [data?.editor?.fullName]);

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

  async function approveTask(): Promise<void> {
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost(`/editor-tasks/${taskId}/approve`, {}, session.user.accessToken);
    showToast('Task approved and payment released');
    await refetch();
  }

  async function rejectTask(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost(
      `/editor-tasks/${taskId}/reject`,
      {
        revisionNotes
      },
      session.user.accessToken
    );
    showToast('Revision requested from editor');
    await refetch();
  }

  function sendChatMessage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!session?.user?.accessToken || !taskId || !chatInput.trim() || !canChat) {
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
        <h1 className="text-2xl font-semibold">Editor Task</h1>
        {data ? (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p><strong>Status:</strong> {data.statusLabel}</p>
            <p><strong>Style:</strong> {data.stylePreference || '-'}</p>
            <p><strong>Estimated:</strong> ${Number(data.estimatedPrice ?? 0).toFixed(2)}</p>
            <p><strong>Editor:</strong> {data.editor?.fullName || 'Unassigned'}</p>
            {data.revisionNotes ? <p><strong>Latest revision request:</strong> {data.revisionNotes}</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Loading task...</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Submitted Work</h2>
        <div className="mt-3 space-y-2">
          {(data?.submittedMediaUrls ?? []).map((url) => (
            <a key={url} href={url} className="block rounded border p-3 text-sm text-slate-700 underline" target="_blank" rel="noreferrer">
              {url}
            </a>
          ))}
          {(data?.submittedMediaUrls ?? []).length === 0 ? <p className="text-sm text-slate-600">No submitted files yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Review Decision</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={approveTask}
            disabled={data?.statusLabel !== 'submitted'}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Approve and Release Payment
          </button>
        </div>
        <form onSubmit={rejectTask} className="mt-4 space-y-3">
          <textarea
            value={revisionNotes}
            onChange={(event) => setRevisionNotes(event.target.value)}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Revision notes"
          />
          <button
            disabled={data?.statusLabel !== 'submitted'}
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Reject and Request Revision
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Chat with Editor</h2>
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
            placeholder={canChat ? 'Type message' : 'Chat available after editor assignment'}
            disabled={!canChat}
          />
          <button disabled={!canChat} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
