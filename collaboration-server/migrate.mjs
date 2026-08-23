import {
  readdir,
  readFile,
} from 'node:fs/promises'

import {
  fileURLToPath,
} from 'node:url'

import {
  closeDatabasePool,
  getDatabasePool,
} from './database.mjs'

const MIGRATION_LOCK_ID =
  17429031

const migrationsDirectory =
  fileURLToPath(
    new URL(
      './migrations/',
      import.meta.url,
    ),
  )

async function ensureMigrationsTable(
  client,
) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  )
}

async function getAppliedMigrations(
  client,
) {
  const result =
    await client.query(
      `SELECT name
       FROM schema_migrations
       ORDER BY name ASC`,
    )

  return new Set(
    result.rows.map(
      (
        row,
      ) =>
        row.name,
    ),
  )
}

async function runMigrations() {
  const database =
    getDatabasePool()

  const client =
    await database.connect()

  try {
    await client.query(
      'SELECT pg_advisory_lock($1)',
      [
        MIGRATION_LOCK_ID,
      ],
    )

    await ensureMigrationsTable(
      client,
    )

    const applied =
      await getAppliedMigrations(
        client,
      )

    const files =
      (
        await readdir(
          migrationsDirectory,
        )
      )
        .filter(
          (
            name,
          ) =>
            /^\d+_.+\.sql$/.test(
              name,
            ),
        )
        .sort()

    let appliedCount =
      0

    for (
      const fileName
      of files
    ) {
      if (
        applied.has(
          fileName,
        )
      ) {
        console.log(
          `Already applied: ${fileName}`,
        )

        continue
      }

      const sql =
        await readFile(
          new URL(
            `./migrations/${fileName}`,
            import.meta.url,
          ),
          'utf8',
        )

      console.log(
        `Applying: ${fileName}`,
      )

      await client.query(
        'BEGIN',
      )

      try {
        await client.query(
          sql,
        )

        await client.query(
          `INSERT INTO schema_migrations (
             name
           )
           VALUES ($1)`,
          [
            fileName,
          ],
        )

        await client.query(
          'COMMIT',
        )

        appliedCount +=
          1
      } catch (
        error
      ) {
        await client.query(
          'ROLLBACK',
        )

        throw error
      }
    }

    console.log(
      appliedCount ===
        0
        ? 'Database schema is already up to date.'
        : `Applied ${appliedCount} migration(s).`,
    )
  } finally {
    try {
      await client.query(
        'SELECT pg_advisory_unlock($1)',
        [
          MIGRATION_LOCK_ID,
        ],
      )
    } catch (
      error
    ) {
      console.error(
        'Failed to release migration lock:',
        error,
      )
    }

    client.release()

    await closeDatabasePool()
  }
}

runMigrations()
  .catch(
    (
      error,
    ) => {
      console.error(
        'Database migration failed:',
        error,
      )

      process.exitCode =
        1
    },
  )
