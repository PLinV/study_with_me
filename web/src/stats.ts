import type { SessionRecord } from './timer';

export interface Bucket {
  cycles: number;
  focusSeconds: number;
}

export interface Stats {
  today: Bucket;
  week: Bucket;
  total: Bucket;
}

// Les sessions sont mises en file localement pour ne rien perdre si l'API est coupée.
const QUEUE_KEY = 'swm.pendingSessions';

function readQueue(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeQueue(queue: SessionRecord[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignoré
  }
}

export async function recordSession(record: SessionRecord): Promise<void> {
  writeQueue([...readQueue(), record]);
  await flushSessions();
}

export async function flushSessions(): Promise<void> {
  const queue = readQueue();
  while (queue.length > 0) {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queue[0]),
      });
      // 400 = session invalide : inutile de la renvoyer indéfiniment.
      if (!res.ok && res.status !== 400) break;
    } catch {
      break;
    }
    queue.shift();
    writeQueue(queue);
  }
}

export async function fetchStats(): Promise<Stats | null> {
  try {
    const res = await fetch('/api/stats');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
