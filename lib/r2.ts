// no-op stub — R2 removed in Phase 21 (CLOUD-03). AWS SDK packages removed from package.json.
// Routes that previously used R2 for PDFs/statements now write to local filesystem via lib/localFiles.ts.

export async function uploadFile(
  _key: string,
  _body: Buffer | Uint8Array,
  _contentType: string
): Promise<string> {
  return _key
}

export async function getPresignedUrl(_key: string): Promise<string> {
  return ''
}

export async function deleteFile(_key: string): Promise<void> {}

export async function fileExists(_key: string): Promise<boolean> {
  return false
}

export function buildR2Key(
  entityType: 'invoices' | 'payslips' | 'statements' | 'logos' | 'attachments',
  companyId: string,
  entityId: string,
  filename: string
): string {
  return `${entityType}/${companyId}/${entityId}/${filename}`
}
