import http from 'node:http';
import pg from 'pg';

const PORT = Number(process.env.PORT ?? 3000);
const TZ = process.env.APP_TZ || 'Europe/Paris';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '';

const KINDS = new Set(['focus', 'short_break', 'long_break']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SECONDS = 4 * 3600;
const MAX_BODY_BYTES = 10_000;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

type Json = Record<string, unknown>;

interface Session {
  id: string;
  kind: string;
  startedAt: Date;
  endedAt: Date;
  plannedSeconds: number;
  actualSeconds: number;
  completed: boolean;
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<Json | null> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_BYTES) return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
  } catch {
    return null;
  }
}

function isSeconds(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SECONDS;
}

function parseSession(body: Json): Session | null {
  const { id, kind, startedAt, endedAt, plannedSeconds, actualSeconds, completed } = body;
  if (typeof id !== 'string' || !UUID_RE.test(id)) return null;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
  if (typeof startedAt !== 'string' || typeof endedAt !== 'string') return null;
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  if (!isSeconds(plannedSeconds) || plannedSeconds === 0 || !isSeconds(actualSeconds)) return null;
  if (typeof completed !== 'boolean') return null;
  return { id, kind, startedAt: start, endedAt: end, plannedSeconds, actualSeconds, completed };
}

async function insertSession(s: Session): Promise<void> {
  await pool.query(
    `INSERT INTO sessions (id, kind, started_at, ended_at, planned_seconds, actual_seconds, completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [s.id, s.kind, s.startedAt, s.endedAt, s.plannedSeconds, s.actualSeconds, s.completed],
  );
}

// Un "cycle" = une session de focus menée jusqu'au bout.
// Le temps de concentration compte aussi les focus interrompus.
const STATS_SQL = `
  WITH bounds AS (
    SELECT date_trunc('day',  now() AT TIME ZONE $1::text) AT TIME ZONE $1::text AS day_start,
           date_trunc('week', now() AT TIME ZONE $1::text) AT TIME ZONE $1::text AS week_start
  )
  SELECT
    count(*) FILTER (WHERE s.kind = 'focus' AND s.completed AND s.started_at >= b.day_start)       AS today_cycles,
    coalesce(sum(s.actual_seconds) FILTER (WHERE s.kind = 'focus' AND s.started_at >= b.day_start), 0)  AS today_seconds,
    count(*) FILTER (WHERE s.kind = 'focus' AND s.completed AND s.started_at >= b.week_start)      AS week_cycles,
    coalesce(sum(s.actual_seconds) FILTER (WHERE s.kind = 'focus' AND s.started_at >= b.week_start), 0) AS week_seconds,
    count(*) FILTER (WHERE s.kind = 'focus' AND s.completed)                                       AS total_cycles,
    coalesce(sum(s.actual_seconds) FILTER (WHERE s.kind = 'focus'), 0)                             AS total_seconds
  FROM bounds b
  LEFT JOIN sessions s ON true
  GROUP BY b.day_start, b.week_start`;

async function getStats() {
  const { rows } = await pool.query(STATS_SQL, [TZ]);
  const r = rows[0];
  return {
    today: { cycles: Number(r.today_cycles), focusSeconds: Number(r.today_seconds) },
    week: { cycles: Number(r.week_cycles), focusSeconds: Number(r.week_seconds) },
    total: { cycles: Number(r.total_cycles), focusSeconds: Number(r.total_seconds) },
  };
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      await pool.query('SELECT 1');
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && pathname === '/api/config') {
      return send(res, 200, { spotifyClientId: SPOTIFY_CLIENT_ID });
    }
    if (req.method === 'GET' && pathname === '/api/stats') {
      return send(res, 200, await getStats());
    }
    if (req.method === 'POST' && pathname === '/api/sessions') {
      const body = await readJson(req);
      const session = body && parseSession(body);
      if (!session) return send(res, 400, { error: 'invalid session' });
      await insertSession(session);
      return send(res, 201, { ok: true });
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'internal error' });
  }
});

server.listen(PORT, () => console.log(`API listening on :${PORT}`));

process.on('SIGTERM', () => {
  server.close(() => void pool.end().then(() => process.exit(0)));
});
