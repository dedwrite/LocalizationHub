CREATE TABLE IF NOT EXISTS project_assignments (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, entry_id)
);

CREATE INDEX IF NOT EXISTS project_assignments_user_index
  ON project_assignments (project_id, user_id);

CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT project_comments_body_check CHECK (CHAR_LENGTH(BTRIM(body)) > 0)
);

CREATE INDEX IF NOT EXISTS project_comments_entry_index
  ON project_comments (project_id, entry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_activity (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_id TEXT,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_activity_project_index
  ON project_activity (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_activity_entry_index
  ON project_activity (project_id, entry_id, created_at DESC);
