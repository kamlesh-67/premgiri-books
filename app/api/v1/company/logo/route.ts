/**
 * POST /api/v1/company/logo  — Upload company logo to Cloudflare R2.
 *
 * Accepts multipart/form-data with a `file` field.
 * Validates MIME type (png/jpeg/webp) and size (max 2 MB).
 * Uploads to R2 key: companies/{companyId}/logo.{ext}
 * Updates company.logoUrl and writes audit log in a single $transaction.
 *
 * Security:
 *  - T-09-03-02: Server-side MIME type + size validation before any R2 operation
 *  - T-09-03-04: companyId always from session.user.companyId
 *  - Rule 7 (CLAUDE.md): audit log in same $transaction as company update
 *
 * R2 env vars required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 */
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/utils/requirePermission'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number]

const MIME_TO_EXT: Record<AllowedMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.user.companyId
  const userId = session.user.id

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate MIME type
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: 'Please upload a PNG, JPG, or WebP image.' },
      { status: 400 },
    )
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File is too large — please choose an image under 2MB.' },
      { status: 400 },
    )
  }

  const mimeType = file.type as AllowedMime
  const ext = MIME_TO_EXT[mimeType]
  const r2Key = `companies/${companyId}/logo.${ext}`

  // Upload to R2 using dynamic import (avoids loading @aws-sdk/client-s3 on every request)
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

  const s3 = new S3Client({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
    region: 'auto',
  })

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: file.type,
    }),
  )

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`

  // Update company.logoUrl + audit log in a single transaction
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: publicUrl },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        userId,
        entity: 'Company',
        entityId: companyId,
        action: 'UPDATE',
        newValue: { logoUrl: publicUrl },
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    }),
  ])

  return NextResponse.json({ logoUrl: publicUrl })
}
