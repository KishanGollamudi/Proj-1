'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { TaskCard } from '@snapmatch/shared';
import { apiGet } from '@/lib/api';

interface EditorTask {
  id: string;
  statusLabel: string;
  stylePreference?: string;
  estimatedPrice?: string;
  dueAt?: string;
  customer?: { fullName?: string } | null;
}

export default function EditorTasksPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['editor-tasks-marketplace'],
    queryFn: () => apiGet<EditorTask[]>('/editor-tasks', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  const pending = (data ?? []).filter((task) => task.statusLabel === 'pending');
  const active = (data ?? []).filter((task) => task.statusLabel === 'assigned' || task.statusLabel === 'changes_requested');

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Editor Tasks</h1>
        <Link href="/portfolio" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Update profile</Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Available Tasks</h2>
        {isLoading ? <p className="text-sm text-slate-600">Loading tasks...</p> : null}
        <div className="grid gap-3">
          {pending.map((task) => (
            <TaskCard key={task.id} task={task} hrefBase="/editor-tasks" />
          ))}
          {pending.length === 0 ? <p className="text-sm text-slate-600">No pending tasks available.</p> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Active Tasks</h2>
        <div className="grid gap-3">
          {active.map((task) => (
            <TaskCard key={task.id} task={task} hrefBase="/editor-tasks" />
          ))}
          {active.length === 0 ? <p className="text-sm text-slate-600">No active tasks assigned to you.</p> : null}
        </div>
      </section>
    </div>
  );
}
