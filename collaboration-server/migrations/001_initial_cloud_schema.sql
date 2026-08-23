CREATE TABLE users (
  id UUID PRIMARY KEY,

  username VARCHAR(32) NOT NULL,

  email TEXT NOT NULL,

  password_salt TEXT NOT NULL,

  password_hash TEXT NOT NULL,

  email_verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_username_length_check
    CHECK (
      CHAR_LENGTH(username)
      BETWEEN 3 AND 32
    ),

  CONSTRAINT users_username_format_check
    CHECK (
      username ~ '^[a-z0-9._-]+$'
    ),

  CONSTRAINT users_username_unique
    UNIQUE (username)
);

CREATE UNIQUE INDEX users_email_lower_unique
  ON users (
    LOWER(email)
  );

CREATE TABLE sessions (
  token_hash CHAR(64) PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT sessions_expiration_check
    CHECK (
      expires_at >
      created_at
    )
);

CREATE INDEX sessions_user_id_index
  ON sessions (
    user_id
  );

CREATE INDEX sessions_expires_at_index
  ON sessions (
    expires_at
  );

CREATE TABLE projects (
  id UUID PRIMARY KEY,

  owner_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  revision INTEGER NOT NULL DEFAULT 1,

  project JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT projects_name_not_empty
    CHECK (
      CHAR_LENGTH(
        BTRIM(name)
      ) > 0
    ),

  CONSTRAINT projects_revision_check
    CHECK (
      revision >= 1
    )
);

CREATE INDEX projects_owner_user_id_index
  ON projects (
    owner_user_id
  );

CREATE INDEX projects_owner_updated_at_index
  ON projects (
    owner_user_id,
    updated_at DESC
  );

CREATE TABLE email_verification_tokens (
  token_hash CHAR(64) PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  expires_at TIMESTAMPTZ NOT NULL,

  used_at TIMESTAMPTZ,

  CONSTRAINT email_verification_expiration_check
    CHECK (
      expires_at >
      created_at
    )
);

CREATE INDEX email_verification_tokens_user_id_index
  ON email_verification_tokens (
    user_id
  );

CREATE INDEX email_verification_tokens_expires_at_index
  ON email_verification_tokens (
    expires_at
  );
