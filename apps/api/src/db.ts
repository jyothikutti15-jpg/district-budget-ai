import { Pool, PoolClient } from 'pg'

// ────────────────────────────────────────────────────────────────
// DATABASE CONNECTION POOL
// Uses pg connection pooling — reuses connections across requests
// ────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 20,              // max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err)
})

// ────────────────────────────────────────────────────────────────
// getDb()
// Returns a client from the pool with RLS district context set.
// THIS IS THE FERPA ENFORCEMENT POINT.
// Every query automatically filters to the current district.
// ────────────────────────────────────────────────────────────────
export async function getDb(districtId: string): Promise<PoolClient> {
  const client = await pool.connect()
  // Set the district context for Row-Level Security
  // All RLS policies use current_setting('app.current_district_id')
  await client.query(
    `SET LOCAL app.current_district_id = '${districtId}'`
  )
  return client
}

// ────────────────────────────────────────────────────────────────
// withDb()
// Convenience wrapper — auto-releases client after callback
// Usage: const result = await withDb(districtId, c => c.query(...))
// ────────────────────────────────────────────────────────────────
export async function withDb<T>(
  districtId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDb(districtId)
  try {
    return await callback(client)
  } finally {
    client.release()
  }
}

// ────────────────────────────────────────────────────────────────
// withTransaction()
// Same as withDb but wraps in BEGIN/COMMIT/ROLLBACK
// ────────────────────────────────────────────────────────────────
export async function withTransaction<T>(
  districtId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDb(districtId)
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ────────────────────────────────────────────────────────────────
// writeAuditLog()
// Every data access gets logged — required for FERPA
// ────────────────────────────────────────────────────────────────
export async function writeAuditLog(params: {
  districtId: string
  userId?: string
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT'
  tableName: string
  recordId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  // Audit log uses direct pool (no RLS — audit log is district-tagged, not filtered)
  await pool.query(
    `INSERT INTO audit_log 
     (district_id, user_id, action, table_name, record_id, old_values, new_values, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.districtId,
      params.userId ?? null,
      params.action,
      params.tableName,
      params.recordId ?? null,
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null,
      params.ipAddress ?? null,
    ]
  )
}

export { pool }
