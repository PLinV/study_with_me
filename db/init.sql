-- Exécuté une seule fois, à la création du volume pgdata.

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
