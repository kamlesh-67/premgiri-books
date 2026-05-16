/**
 * scripts/smoke-test-deploy.ts
 *
 * Post-deploy health check. Run after `vercel deploy` to verify DB and Redis
 * are connected in the production environment.
 *
 * Usage:
 *   APP_URL=https://premgiribooks.vercel.app npx tsx scripts/smoke-test-deploy.ts
 *
 * Exit codes:
 *   0 — health check passed
 *   1 — health check failed (network error, wrong status, or degraded services)
 */

const BASE_URL =
  process.env.SMOKE_TEST_URL ??
  process.env.APP_URL ??
  'http://localhost:3000'

const HEALTH_URL = `${BASE_URL}/api/v1/health`

interface HealthResponse {
  status: string
  db: string
  redis: string
}

async function runSmokeTest(): Promise<void> {
  console.log(`[smoke-test] Checking: ${HEALTH_URL}`)

  let res: Response
  try {
    res = await fetch(HEALTH_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[smoke-test] FAILED — Network error: ${message}`)
    process.exit(1)
  }

  if (!res.ok) {
    console.error(
      `[smoke-test] FAILED — HTTP ${res.status} ${res.statusText} from ${HEALTH_URL}`
    )
    process.exit(1)
  }

  let body: HealthResponse
  try {
    body = (await res.json()) as HealthResponse
  } catch {
    console.error('[smoke-test] FAILED — Response body is not valid JSON')
    process.exit(1)
  }

  const { status, db, redis } = body

  if (status !== 'ok') {
    console.error(`[smoke-test] FAILED — status is "${status}", expected "ok"`)
    console.error(`[smoke-test]   db:    ${db}`)
    console.error(`[smoke-test]   redis: ${redis}`)
    process.exit(1)
  }

  if (db !== 'connected') {
    console.error(`[smoke-test] FAILED — db is "${db}", expected "connected"`)
    process.exit(1)
  }

  if (redis !== 'connected') {
    console.error(`[smoke-test] FAILED — redis is "${redis}", expected "connected"`)
    process.exit(1)
  }

  console.log('[smoke-test] PASSED')
  console.log(`[smoke-test]   status: ${status}`)
  console.log(`[smoke-test]   db:     ${db}`)
  console.log(`[smoke-test]   redis:  ${redis}`)
  process.exit(0)
}

runSmokeTest().catch((err: unknown) => {
  console.error('[smoke-test] Unexpected error:', err)
  process.exit(1)
})
