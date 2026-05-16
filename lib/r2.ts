import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.NODE_ENV === 'development',
})

const BUCKET = process.env.R2_BUCKET_NAME!

// Pre-signed URL expiry: exactly 15 minutes — NEVER change this (SETUP-09)
const URL_EXPIRY_SECONDS = 15 * 60

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
  return key
}

export async function getPresignedUrl(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: URL_EXPIRY_SECONDS })
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

export function buildR2Key(
  entityType: 'invoices' | 'payslips' | 'statements' | 'logos' | 'attachments',
  companyId: string,
  entityId: string,
  filename: string
): string {
  return `${entityType}/${companyId}/${entityId}/${filename}`
}
