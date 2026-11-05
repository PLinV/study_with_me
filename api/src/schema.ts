import type pg from 'pg';

// Le schéma est créé par l'API au démarrage (idempotent), pour que les nouvelles
// tables apparaissent aussi dans une base déjà existante.
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
      id              UUID PRIMARY KEY,          -- généré par le navigateur, rend les ré-envois idempotents
      kind            TEXT        NOT NULL CHECK (kind IN ('focus', 'short_break', 'long_break')),
      started_at      TIMESTAMPTZ NOT NULL,
      ended_at        TIMESTAMPTZ NOT NULL,
      planned_seconds INTEGER     NOT NULL CHECK (planned_seconds > 0),
      actual_seconds  INTEGER     NOT NULL CHECK (actual_seconds >= 0),
      completed       BOOLEAN     NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS sessions_started_at_idx ON sessions (started_at);

  CREATE TABLE IF NOT EXISTS tasks (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title        TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
      status       TEXT        NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
  );
`;

const RETRIES = 10;
const RETRY_DELAY_MS = 1000;

export async function ensureSchema(pool: pg.Pool): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(SCHEMA_SQL);
      return;
    } catch (err) {
      if (attempt >= RETRIES) throw err;
      console.warn(`Base pas encore prête (tentative ${attempt}/${RETRIES})…`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}
