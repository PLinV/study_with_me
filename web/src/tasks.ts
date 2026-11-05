export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}

/** Ordre du cycle quand on clique sur l'icône de statut. */
export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Impossible d’enregistrer la tâche (base de données injoignable ?)');
  return res.status === 204 ? null : res.json();
}

export const tasksApi = {
  list: () => request<Task[]>('GET', '/api/tasks').then((t) => t ?? []),
  create: (title: string) => request<Task>('POST', '/api/tasks', { title }),
  update: (id: string, changes: { title?: string; status?: TaskStatus }) =>
    request<Task>('PATCH', `/api/tasks/${id}`, changes),
  remove: (id: string) => request<null>('DELETE', `/api/tasks/${id}`),
  clearDone: () => request<null>('DELETE', '/api/tasks?status=done'),
};
