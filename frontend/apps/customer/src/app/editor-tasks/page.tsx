'use client';

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
  editor?: { fullName?: string } | null;
}

export default function CustomerEditorTasksPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['customer-editor-tasks'],
    queryFn: () => apiGet<EditorTask[]>('/editor-tasks', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Editor Tasks</h1>
      {isLoading ? <p className="text-sm text-slate-600">Loading tasks...</p> : null}
      <div className="grid gap-3">
        {(data ?? []).map((task) => (
          <TaskCard key={task.id} task={task} hrefBase="/editor-tasks" />
        ))}
        {(data ?? []).length === 0 ? <p className="text-sm text-slate-600">No editor tasks yet.</p> : null}
      </div>
    </div>
  );
}
