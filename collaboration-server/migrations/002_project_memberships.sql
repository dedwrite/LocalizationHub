CREATE TABLE project_memberships (
  project_id UUID NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (
    project_id,
    user_id
  ),

  CONSTRAINT project_memberships_role_check
    CHECK (
      role IN (
        'editor',
        'viewer'
      )
    )
);

CREATE INDEX project_memberships_user_id_index
  ON project_memberships (
    user_id
  );

CREATE INDEX project_memberships_user_updated_at_index
  ON project_memberships (
    user_id,
    updated_at DESC
  );

CREATE INDEX project_memberships_project_role_index
  ON project_memberships (
    project_id,
    role
  );
