import pg from 'pg'

const {
  Pool,
} = pg

let pool =
  null

let testPool =
  null

export function setDatabasePoolForTests(value) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database test overrides require NODE_ENV=test.')
  }
  testPool = value
}

export function resetDatabasePoolForTests() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database test overrides require NODE_ENV=test.')
  }
  testPool = null
}

function getPoolMax() {
  const configured =
    Number(
      process.env.DB_POOL_MAX ??
        5,
    )

  if (
    !Number.isInteger(
      configured,
    ) ||
    configured < 1 ||
    configured > 50
  ) {
    throw new Error(
      'DB_POOL_MAX must be an integer between 1 and 50.',
    )
  }

  return configured
}

export function isDatabaseConfigured() {
  return Boolean(
    process.env.DATABASE_URL
      ?.trim(),
  )
}

export function getDatabasePool() {
  if (testPool) return testPool

  if (pool) {
    return pool
  }

  const connectionString =
    process.env.DATABASE_URL
      ?.trim()

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not configured.',
    )
  }

  pool =
    new Pool({
      connectionString,

      max:
        getPoolMax(),

      idleTimeoutMillis:
        30_000,

      connectionTimeoutMillis:
        10_000,

      application_name:
        'localizationhub-relay',
    })

  pool.on(
    'error',
    (error) => {
      console.error(
        'Unexpected PostgreSQL pool error:',
        error,
      )
    },
  )

  return pool
}

export async function checkDatabaseConnection() {
  const database =
    getDatabasePool()

  const result =
    await database.query(
      `SELECT
         current_database() AS database_name,
         current_user AS database_user,
         NOW() AS server_time`,
    )

  return result.rows[0]
}

export async function closeDatabasePool() {
  if (!pool) {
    return
  }

  const currentPool =
    pool

  pool =
    null

  await currentPool.end()
}
