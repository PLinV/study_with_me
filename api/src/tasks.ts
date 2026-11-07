import type pg from 'pg';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const MAX_TITLE = 200;

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  created_at: Date;
  completed_at: Date | null;
}

const COLUMNS = 'id, title, status, created_at, completed_at';

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export function parseTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  return title.length > 0 && title.length <= MAX_TITLE ? title : null;
}

export function parseStatus(value: unknown): TaskStatus | null {
  return TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : null;
}

export async function listTasks(pool: pg.Pool): Promise<Task[]> {
  const { rows } = await pool.query<TaskRow>(`SELECT ${COLUMNS} FROM tasks ORDER BY created_at`);
  return rows.map(toTask);
}

export async function createTask(pool: pg.Pool, title: string): Promise<Task> {
  const { rows } = await pool.query<TaskRow>(`INSERT INTO tasks (title) VALUES ($1) RETURNING ${COLUMNS}`, [title]);
  return toTask(rows[0]);
}

/** Met à jour le titre et/ou le statut. Plusieurs tâches peuvent être "en cours" en même temps. */
export async function updateTask(
  pool: pg.Pool,
  id: string,
  changes: { title?: string; status?: TaskStatus },
): Promise<Task | null> {
  const { rows } = await pool.query<TaskRow>(
    `UPDATE tasks SET
       title = COALESCE($2, title),
       status = COALESCE($3, status),
       completed_at = CASE
         WHEN $3::text IS NULL THEN completed_at
         WHEN $3::text = 'done' THEN COALESCE(completed_at, now())
         ELSE NULL
       END
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, changes.title ?? null, changes.status ?? null],
  );
  return rows[0] ? toTask(rows[0]) : null;
}

export async function deleteTask(pool: pg.Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function deleteDoneTasks(pool: pg.Pool): Promise<void> {
  await pool.query(`DELETE FROM tasks WHERE status = 'done'`);
}
