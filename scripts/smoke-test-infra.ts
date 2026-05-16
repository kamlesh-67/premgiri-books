#!/usr/bin/env tsx
/**
 * Phase 0 Infrastructure Smoke Test
 * Verifies: MinIO upload, Mailhog email, Inngest dev server, PostHog event
 * Run: pnpm smoke-test
 * All services must be running (docker compose up -d && npx inngest-cli@latest dev)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as nodemailer from 'nodemailer'

// Load .env.local
import { config } from 'dotenv'
config({ path: '.env.local' })

const PASS = 'PASS'
const FAIL = 'FAIL'
const results: Array<{ name: string; passed: boolean; detail: string }> = []

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail })
  const icon = passed ? PASS : FAIL
  console.log(`  [${icon}] ${name}: ${detail}`)
}

// --- 1. MinIO File Upload -----------------------------------------------------
async function testMinIO() {
  console.log('\n[1/4] MinIO File Upload')
  try {
    const s3 = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.R2_ENDPOINT ?? 'http://localhost:9000',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? 'minioadmin',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? 'minioadmin',
      },
      forcePathStyle: true,
    })

    const testKey = `smoke-test/${Date.now()}.txt`
    const testContent = Buffer.from(`PremGiri Books smoke test -- ${new Date().toISOString()}`)

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME ?? 'premgiri-dev',
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    }))

    record('MinIO upload', true, `Uploaded ${testKey} to ${process.env.R2_BUCKET_NAME ?? 'premgiri-dev'}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    record('MinIO upload', false, `FAILED: ${msg}. Is docker compose up? Is bucket premgiri-dev created?`)
  }
}

// --- 2. Mailhog Email ---------------------------------------------------------
async function testMailhog() {
  console.log('\n[2/4] Mailhog Email (SMTP)')
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
      secure: false,
      ignoreTLS: true,
    } as nodemailer.TransportOptions)

    await transporter.sendMail({
      from: 'smoke-test@premgiribooks.com',
      to: 'test@example.com',
      subject: 'PremGiri Books -- Smoke Test',
      html: '<p>Infrastructure smoke test email. Check Mailhog at http://localhost:8025</p>',
    })

    record('Mailhog email', true, 'Email sent. View at http://localhost:8025')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    record('Mailhog email', false, `FAILED: ${msg}. Is Mailhog container running? Port 1025?`)
  }
}

// --- 3. Inngest Dev Server ----------------------------------------------------
async function testInngest() {
  console.log('\n[3/4] Inngest Dev Server')
  try {
    const inngestUrl = process.env.INNGEST_DEV_SERVER_URL ?? 'http://localhost:8288'
    const response = await fetch(`${inngestUrl}/`, { signal: AbortSignal.timeout(5000) })

    if (response.ok || response.status === 404) {
      record('Inngest dev server', true, `Reachable at ${inngestUrl} (status: ${response.status})`)
    } else {
      record('Inngest dev server', false, `Status ${response.status}. Run: npx inngest-cli@latest dev`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    record('Inngest dev server', false, `FAILED: ${msg}. Run: npx inngest-cli@latest dev`)
  }
}

// --- 4. PostHog Event ---------------------------------------------------------
async function testPostHog() {
  console.log('\n[4/4] PostHog Event Capture')
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key || key.includes('replace_with') || key.includes('your_')) {
      record('PostHog key', false, 'NEXT_PUBLIC_POSTHOG_KEY not set -- update .env.local with real PostHog project key')
      return
    }

    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'
    const response = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: 'app_loaded',
        distinct_id: 'smoke-test',
        properties: { source: 'smoke-test-infra', timestamp: new Date().toISOString() },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok || response.status === 200) {
      record('PostHog event', true, `app_loaded event captured. Check PostHog Live Events at ${host}`)
    } else {
      record('PostHog event', false, `HTTP ${response.status} from PostHog. Check API key.`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    record('PostHog event', false, `FAILED: ${msg}`)
  }
}

// --- Run All Tests ------------------------------------------------------------
async function main() {
  console.log('PremGiri Books -- Phase 0 Infrastructure Smoke Test')
  console.log('='.repeat(50))
  console.log('Checking all local dev services...\n')

  await testMinIO()
  await testMailhog()
  await testInngest()
  await testPostHog()

  console.log('\n' + '='.repeat(50))
  console.log('Results:')
  const passed = results.filter(r => r.passed).length
  const total = results.length
  results.forEach(r => console.log(`  [${r.passed ? PASS : FAIL}] ${r.name}`))
  console.log(`\n${passed}/${total} checks passed`)

  if (passed < total) {
    console.log('\nFailed checks -- see details above. Fix before executing Phase 1.')
    process.exit(1)
  } else {
    console.log('\nAll infrastructure checks passed. Phase 0 complete!')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
