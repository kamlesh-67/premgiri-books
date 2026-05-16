/**
 * EInvoiceService.ts
 *
 * IRP (Invoice Registration Portal) API client for generating and cancelling IRNs
 * (Invoice Reference Numbers) for Sales Invoices.
 *
 * Security:
 *  - T-08-02-01: IRP credentials never logged (filtered in request headers)
 *  - T-08-02-02: IDOR protection — all voucher fetches scoped by companyId
 *  - T-08-02-03: SEK stored in Redis with TTL — never in module scope
 *  - T-08-02-04: Mock mode blocked in production (NODE_ENV === 'production')
 *  - T-08-02-05: Duplicate IRN (error 2150) handled via GET existing IRN
 */
import { randomBytes } from 'crypto'
import * as forge from 'node-forge'
import { prisma } from '@/lib/prisma'
import { getCache, setCache } from '@/lib/redis'
import { Decimal } from 'decimal.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const IRP_BASE_URL = process.env.IRP_BASE_URL ?? 'https://einv-apisandbox.nic.in'
/** 5 hours — 1-hour buffer vs 6-hour IRP token validity */
const CACHE_TTL = 60 * 60 * 5
const cacheKey = (gstin: string) => `irp:token:${gstin}`

// ─── Types ────────────────────────────────────────────────────────────────────

export type EwbDtls = {
  TransMode: '1' | '2' | '3' | '4'  // Road / Rail / Air / Ship
  Distance: number
  TransId?: string    // Transporter GSTIN
  TransName?: string
  VehNo?: string
  VehType?: 'R' | 'O'
}

export type IrnResult = {
  irn: string
  ackNo: string
  ackDt: string
  signedQrCode: string
  ewbNo?: string
  ewbValidUntil?: Date
}

// ─── isEligible ───────────────────────────────────────────────────────────────

/**
 * Checks whether a voucher is eligible for IRN generation.
 * Does NOT call the IRP — purely local validation.
 */
export function isEligible(
  voucher: {
    status: string
    voucherType: string
    totalAmount: string
    irn: string | null
    date?: Date
    partyLedger?: { gstin: string | null } | null
  },
  company: { annualTurnover: string | null },
): { eligible: boolean; reason?: string } {
  if (voucher.status !== 'POSTED') {
    return { eligible: false, reason: 'Voucher must be POSTED before generating IRN' }
  }
  if (voucher.voucherType !== 'SALES') {
    return { eligible: false, reason: 'IRN is only applicable for SALES vouchers' }
  }
  if (!voucher.partyLedger?.gstin) {
    return { eligible: false, reason: 'Party must have a GSTIN for e-Invoice generation' }
  }
  if (voucher.irn) {
    return { eligible: false, reason: 'IRN already generated for this voucher' }
  }

  // 30-day IRP reporting window (AATO >= ₹10Cr from April 2025)
  if (company.annualTurnover && voucher.date) {
    const turnover = new Decimal(company.annualTurnover)
    const TEN_CRORE = new Decimal('100000000')
    if (turnover.gte(TEN_CRORE)) {
      const daysSince = Math.floor(
        (Date.now() - voucher.date.getTime()) / (1000 * 60 * 60 * 24),
      )
      if (daysSince > 30) {
        return {
          eligible: false,
          reason: 'Invoice date is older than 30 days — IRP will reject (reporting deadline exceeded)',
        }
      }
      if (daysSince > 25) {
        // Allow but warn — caller surfaces this in the UI
        return {
          eligible: true,
          reason: 'Warning: Invoice date is more than 25 days old — only 5 days remaining before IRP deadline',
        }
      }
    }
  }

  return { eligible: true }
}

// ─── buildPayload ──────────────────────────────────────────────────────────────

/**
 * Constructs the IRP v1.1 JSON payload from a voucher and company.
 * Returns a plain object (not encrypted) — encryption is done in generateIrn.
 */
export function buildPayload(
  voucher: {
    voucherNo: string
    date: Date
    totalAmount: string
    cgstAmount: string
    sgstAmount: string
    igstAmount: string
    roundOff: string
    partyLedger: { gstin: string; name: string }
    items: Array<{
      qty: string
      rate: string
      amount: string
      discountAmt: string
      cgstRate: string
      cgstAmt: string
      sgstRate: string
      sgstAmt: string
      igstRate: string
      igstAmt: string
      hsnCode: string
      stockItem: { name: string; uom: { symbol: string } }
    }>
  },
  company: { gstin: string; stateCode: string; name: string },
  ewbDtls?: EwbDtls,
): Record<string, unknown> {
  const d = voucher.date
  const docDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const buyerStateCode = voucher.partyLedger.gstin.slice(0, 2)

  // WR-03: configurable seller PIN -- IRP live mode requires real pincode
  // TODO: add pincode field to Company schema (Phase 9)
  const sellerPin = parseInt(process.env.IRP_SELLER_PIN ?? '000000', 10)
  if (process.env.IRP_MOCK_MODE !== 'true' && !sellerPin) {
    throw new Error('IRP_SELLER_PIN not configured -- required for live IRN generation')
  }

  const itemList = voucher.items.map((item, idx) => {
    const assAmt = new Decimal(item.amount).minus(new Decimal(item.discountAmt))
    const gstRt = new Decimal(item.cgstRate)
      .plus(new Decimal(item.sgstRate))
      .plus(new Decimal(item.igstRate))
    const totItemVal = assAmt
      .plus(new Decimal(item.cgstAmt))
      .plus(new Decimal(item.sgstAmt))
      .plus(new Decimal(item.igstAmt))

    return {
      SlNo: String(idx + 1),
      PrdDesc: item.stockItem.name,
      IsServc: 'N',
      HsnCd: item.hsnCode,
      Qty: new Decimal(item.qty).toNumber(),
      Unit: item.stockItem.uom.symbol,
      UnitPrice: new Decimal(item.rate).toNumber(),
      TotAmt: new Decimal(item.amount).toNumber(),
      Discount: new Decimal(item.discountAmt).toNumber(),
      AssAmt: assAmt.toNumber(),
      GstRt: gstRt.toNumber(),
      CgstAmt: new Decimal(item.cgstAmt).toNumber(),
      SgstAmt: new Decimal(item.sgstAmt).toNumber(),
      IgstAmt: new Decimal(item.igstAmt).toNumber(),
      CesAmt: 0,
      CesRt: 0,
      CesNonAdvlAmt: 0,
      TotItemVal: totItemVal.toNumber(),
    }
  })

  const payload: Record<string, unknown> = {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',  // always B2B for SALES to GSTIN party
      RegRev: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: voucher.voucherNo,
      Dt: docDate,
    },
    SellerDtls: {
      Gstin: company.gstin,
      LglNm: company.name,
      Loc: company.stateCode,
      Pin: sellerPin || 560001,  // Company model has no pincode field yet
      Stcd: company.stateCode,
      Addr1: 'N/A',
    },
    BuyerDtls: {
      Gstin: voucher.partyLedger.gstin,
      LglNm: voucher.partyLedger.name,
      Pos: buyerStateCode,
      Loc: buyerStateCode,
      Pin: sellerPin || 560001,
      Stcd: buyerStateCode,
      Addr1: 'N/A',
    },
    ValDtls: {
      AssVal: itemList.reduce((s, i) => s + i.AssAmt, 0),
      CgstVal: new Decimal(voucher.cgstAmount).toNumber(),
      SgstVal: new Decimal(voucher.sgstAmount).toNumber(),
      IgstVal: new Decimal(voucher.igstAmount).toNumber(),
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: new Decimal(voucher.roundOff).toNumber(),
      TotInvVal: new Decimal(voucher.totalAmount).toNumber(),
    },
    ItemList: itemList,
  }

  if (ewbDtls) {
    payload.EwbDtls = ewbDtls
  }

  return payload
}

// ─── cancelIrn ────────────────────────────────────────────────────────────────

/**
 * Cancels an existing IRN on the IRP.
 * Supported only within 24 hours of generation.
 */
export async function cancelIrn(
  voucherId: string,
  companyId: string,
  reason: string,
  remark: string,
  userId?: string,  // WR-02: added for audit attribution
): Promise<void> {
  // CR-03: same guard as generateIrn -- mock mode must not be enabled in production
  if (process.env.NODE_ENV === 'production' && process.env.IRP_MOCK_MODE === 'true') {
    throw new Error('IRP_MOCK_MODE=true is not allowed in production')
  }

  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, companyId },
    select: { irn: true },
  })
  if (!voucher?.irn) throw new Error('Voucher has no IRN to cancel')

  if (process.env.IRP_MOCK_MODE === 'true') {
    await prisma.voucher.update({
      where: { id: voucherId },
      data: { irn: null, irnQrCode: null, irnGeneratedAt: null },
    })
    return
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { gstin: true },
  })
  if (!company.gstin) throw new Error('Company GSTIN not configured')

  const { token, sek } = await getAuthToken(company.gstin)
  const body = { Irn: voucher.irn, CnlRsn: reason, CnlRem: remark }
  const rawRes = await irpPost('/api/Invoice/Cancel', body, token, company.gstin) as { Data: string }
  decryptResponse(rawRes.Data, sek)  // validate response is parseable

  await prisma.$transaction([
    prisma.voucher.update({
      where: { id: voucherId },
      data: { irn: null, irnQrCode: null, irnGeneratedAt: null },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        userId: userId ?? 'system',  // WR-02: use caller-supplied userId
        entity: 'Voucher',
        entityId: voucherId,
        action: 'UPDATE',
        newValue: { irn: null, cancelReason: reason } as object,
      },
    }),
  ])
}

// ─── generateIrn ──────────────────────────────────────────────────────────────

/**
 * Generates an IRN by authenticating with the IRP, building and encrypting
 * the payload, and persisting the result.
 *
 * Uses IRP_MOCK_MODE=true in development (required in production: NODE_ENV check).
 */
export async function generateIrn(
  voucherId: string,
  companyId: string,
  ewbDtls?: EwbDtls,
  userId?: string,
): Promise<IrnResult> {
  // T-08-02-04: mock mode must not be enabled in production
  if (process.env.NODE_ENV === 'production' && process.env.IRP_MOCK_MODE === 'true') {
    throw new Error('IRP_MOCK_MODE=true is not allowed in production')
  }

  // 1. Fetch voucher (IDOR scoped to companyId — T-08-02-02)
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, companyId },
    include: {
      partyLedger: { select: { gstin: true, name: true } },
      voucherItems: { include: { item: { include: { uom: true } } } },
    },
  })
  if (!voucher) throw new Error('Voucher not found')

  // 2. Fetch company
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { gstin: true, stateCode: true, name: true, annualTurnover: true },
  })
  if (!company.gstin) throw new Error('Company GSTIN not configured')

  // 3. Eligibility check
  const eligibilityVoucher = {
    status: voucher.status,
    voucherType: voucher.voucherType,
    totalAmount: voucher.totalAmount.toString(),
    irn: voucher.irn,
    date: voucher.date,
    partyLedger: voucher.partyLedger,
  }
  const check = isEligible(eligibilityVoucher, {
    annualTurnover: company.annualTurnover?.toString() ?? null,
  })
  if (!check.eligible) throw new Error(check.reason)

  // 4. Mock mode (dev / test only)
  if (process.env.IRP_MOCK_MODE === 'true') {
    const mockResult: IrnResult = {
      irn: `MOCK${voucherId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 60)}`.padEnd(64, '0'),
      ackNo: '232300000001',
      ackDt: new Date().toISOString(),
      signedQrCode: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.bW9jaw.bW9jaw',
      ewbNo: ewbDtls ? '681234567890' : undefined,
      ewbValidUntil: ewbDtls ? new Date(Date.now() + 72 * 60 * 60 * 1000) : undefined,
    }
    await storeIrn(voucherId, companyId, mockResult, userId)
    return mockResult
  }

  // 5. Auth token (Redis-cached — T-08-02-03)
  const { token, sek } = await getAuthToken(company.gstin)

  // 6. Build and encrypt payload
  const buildVoucher = {
    voucherNo: voucher.voucherNo,
    date: voucher.date,
    totalAmount: voucher.totalAmount.toString(),
    cgstAmount: voucher.cgstAmount.toString(),
    sgstAmount: voucher.sgstAmount.toString(),
    igstAmount: voucher.igstAmount.toString(),
    roundOff: voucher.roundOff.toString(),
    partyLedger: voucher.partyLedger as { gstin: string; name: string },
    items: voucher.voucherItems.map((item) => ({
      qty: item.qty.toString(),
      rate: item.rate.toString(),
      amount: item.amount.toString(),
      discountAmt: (item.discountAmt ?? '0').toString(),
      cgstRate: (item.cgstRate ?? '0').toString(),
      cgstAmt: (item.cgstAmt ?? '0').toString(),
      sgstRate: (item.sgstRate ?? '0').toString(),
      sgstAmt: (item.sgstAmt ?? '0').toString(),
      igstRate: (item.igstRate ?? '0').toString(),
      igstAmt: (item.igstAmt ?? '0').toString(),
      hsnCode: item.hsnCode ?? '',
      stockItem: { name: item.item.name, uom: { symbol: item.item.uom.symbol } },
    })),
  }
  const payload = buildPayload(buildVoucher, { ...company, gstin: company.gstin! }, ewbDtls)
  const encrypted = encryptPayload(payload, sek)

  let irpData: Record<string, unknown>
  try {
    // 7. POST to IRP — returns raw { Status, Data, ErrorDetails }
    const rawRes = await irpPost('/api/Invoice', { Data: encrypted }, token, company.gstin) as { Data: string }
    // 8. Decrypt response using sek
    irpData = decryptResponse(rawRes.Data, sek) as Record<string, unknown>
  } catch (err: unknown) {
    // 9. Error 2150 recovery: duplicate IRN — fetch the existing one (T-08-02-05)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('2150')) {
      const existingIrn = computeIrnHash(company.gstin, {
        voucherNo: voucher.voucherNo,
        date: voucher.date,
      })
      irpData = await irpGet(
        '/api/Invoice/irn',
        { irn: existingIrn },
        token,
        company.gstin,
      ) as Record<string, unknown>
    } else {
      await logIrpAttempt(voucherId, companyId, 'FAILED', msg, payload)
      throw err
    }
  }

  const result: IrnResult = {
    irn: irpData['Irn'] as string,
    ackNo: irpData['AckNo'] as string,
    ackDt: irpData['AckDt'] as string,
    signedQrCode: irpData['SignedQRCode'] as string,
    ewbNo: irpData['EwbNo'] as string | undefined,
    ewbValidUntil: irpData['EwbValidTill']
      ? new Date(irpData['EwbValidTill'] as string)
      : undefined,
  }

  await logIrpAttempt(voucherId, companyId, 'SUCCESS', undefined, payload, irpData)
  await storeIrn(voucherId, companyId, result, userId)
  return result
}

// ─── generateStandaloneEwb ────────────────────────────────────────────────────

/**
 * Generates a standalone e-Way Bill for a voucher that already has an IRN.
 * Used when transport details are not available at the time of IRN generation.
 */
export async function generateStandaloneEwb(
  voucherId: string,
  companyId: string,
  ewbDtls: EwbDtls,
  userId?: string,
): Promise<{ ewbNo: string; ewbValidUntil: Date }> {
  // WR-01: same guard as generateIrn -- mock mode must not be enabled in production
  if (process.env.NODE_ENV === 'production' && process.env.IRP_MOCK_MODE === 'true') {
    throw new Error('IRP_MOCK_MODE=true is not allowed in production')
  }

  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, companyId },
    select: { irn: true, eWayBillNo: true },
  })
  if (!voucher) throw new Error('Voucher not found')
  if (!voucher.irn) throw new Error('IRN must be generated before e-Way Bill')
  if (voucher.eWayBillNo) throw new Error('e-Way Bill already generated for this voucher')

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { gstin: true },
  })

  if (process.env.IRP_MOCK_MODE === 'true') {
    const result = {
      ewbNo: '681234567891',
      ewbValidUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
    }
    await prisma.$transaction([
      prisma.voucher.update({
        where: { id: voucherId },
        data: { eWayBillNo: result.ewbNo, eWayBillValidUntil: result.ewbValidUntil },
      }),
      prisma.auditLog.create({
        data: {
          companyId,
          userId: userId ?? 'system',
          entity: 'Voucher',
          entityId: voucherId,
          action: 'UPDATE',
          newValue: { eWayBillNo: result.ewbNo } as object,
        },
      }),
    ])
    return result
  }

  const { token, sek } = await getAuthToken(company.gstin!)
  const payload = { Irn: voucher.irn, ...ewbDtls }
  const encrypted = encryptPayload(payload, sek)
  const rawRes = await irpPost(
    '/api/einvewb/ewaybill',
    { Data: encrypted },
    token,
    company.gstin!,
  ) as { Data: string }
  const data = decryptResponse(rawRes.Data, sek) as { EwbNo: string; EwbValidTill: string }

  const result = { ewbNo: data.EwbNo, ewbValidUntil: new Date(data.EwbValidTill) }
  await prisma.$transaction([
    prisma.voucher.update({
      where: { id: voucherId },
      data: { eWayBillNo: result.ewbNo, eWayBillValidUntil: result.ewbValidUntil },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        userId: userId ?? 'system',
        entity: 'Voucher',
        entityId: voucherId,
        action: 'UPDATE',
        newValue: { eWayBillNo: result.ewbNo } as object,
      },
    }),
  ])
  return result
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Gets or refreshes the IRP auth token from Redis cache.
 * Uses RSA-PKCS1v1.5 encryption of app_key and password with NIC public key.
 * Decrypts SEK using AES-ECB with app_key.
 */
async function getAuthToken(gstin: string): Promise<{ token: string; sek: string }> {
  const cached = await getCache<{ token: string; sek: string }>(cacheKey(gstin))
  if (cached) return cached

  // Generate cryptographically secure 32-byte (256-bit) AES app_key (CR-04)
  const appKey = randomBytes(32).toString('hex')

  const publicKeyPem = Buffer.from(process.env.IRP_PUBLIC_KEY!, 'base64').toString('utf8')
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem)

  const encryptedAppKey = forge.util.encode64(
    publicKey.encrypt(appKey, 'RSAES-PKCS1-V1_5'),
  )
  const encryptedPassword = forge.util.encode64(
    publicKey.encrypt(process.env.IRP_PASSWORD!, 'RSAES-PKCS1-V1_5'),
  )

  const res = await fetch(`${IRP_BASE_URL}/api/auth`, {
    method: 'POST',
    headers: {
      'client_id': process.env.IRP_CLIENT_ID!,
      'client_secret': process.env.IRP_CLIENT_SECRET!,
      'Gstin': gstin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'ACCESSTOKEN',
      username: process.env.IRP_USERNAME!,
      password: encryptedPassword,
      app_key: encryptedAppKey,
      ForceRefreshAccessToken: false,
    }),
  })

  if (!res.ok) throw new Error(`IRP auth failed: ${res.status}`)
  const authRes = await res.json() as {
    Status: string
    AuthToken?: string
    Sek?: string
  }
  if (authRes.Status !== '1') throw new Error(`IRP auth error: ${JSON.stringify(authRes)}`)

  // Decrypt SEK: Base64 decode → AES-ECB decrypt using appKey
  const appKeyBuf = forge.util.createBuffer(
    Buffer.from(appKey, 'hex').toString('binary'),
  )
  const dec = forge.cipher.createDecipher('AES-ECB', appKeyBuf)
  dec.start()
  dec.update(
    forge.util.createBuffer(Buffer.from(authRes.Sek!, 'base64').toString('binary')),
  )
  dec.finish()
  const sek = forge.util.encode64(dec.output.bytes())

  const result = { token: authRes.AuthToken!, sek }
  // T-08-02-03: store in Redis with TTL — never in module scope
  await setCache(cacheKey(gstin), result, CACHE_TTL)
  return result
}

/**
 * AES-256-ECB encrypt JSON payload using SEK (Base64-encoded key).
 * Returns Base64-encoded ciphertext.
 */
function encryptPayload(json: object, sek: string): string {
  const keyBuf = forge.util.createBuffer(Buffer.from(sek, 'base64').toString('binary'))
  const cipher = forge.cipher.createCipher('AES-ECB', keyBuf)
  cipher.start()
  cipher.update(forge.util.createBuffer(JSON.stringify(json), 'utf8'))
  cipher.finish()
  return Buffer.from(cipher.output.bytes(), 'binary').toString('base64')
}

/**
 * AES-256-ECB decrypt IRP response data using SEK (Base64-encoded key).
 * Returns parsed JSON object.
 */
function decryptResponse(data: string, sek: string): object {
  const keyBuf = forge.util.createBuffer(Buffer.from(sek, 'base64').toString('binary'))
  const dec = forge.cipher.createDecipher('AES-ECB', keyBuf)
  dec.start()
  dec.update(forge.util.createBuffer(Buffer.from(data, 'base64').toString('binary')))
  dec.finish()
  return JSON.parse(dec.output.toString()) as object
}

/**
 * POST to IRP API.
 * Returns raw response JSON (caller decrypts Data field using sek).
 * T-08-02-01: headers with credentials never logged.
 */
async function irpPost(
  path: string,
  body: object,
  token: string,
  gstin: string,
): Promise<object> {
  const res = await fetch(`${IRP_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'client_id': process.env.IRP_CLIENT_ID!,
      'client_secret': process.env.IRP_CLIENT_SECRET!,
      'Gstin': gstin,
      'user_name': process.env.IRP_USERNAME!,
      'AuthToken': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`IRP POST ${path} failed: ${res.status}`)
  const json = await res.json() as {
    Status: string
    Data?: string
    ErrorDetails?: Array<{ ErrorCode: string; ErrorMessage: string }>
  }
  if (json.Status !== '1') {
    const errCode = json.ErrorDetails?.[0]?.ErrorCode ?? 'UNKNOWN'
    const errMsg = json.ErrorDetails?.[0]?.ErrorMessage ?? JSON.stringify(json)
    throw new Error(`${errCode}: ${errMsg}`)
  }
  // Return raw — caller calls decryptResponse(json.Data, sek)
  return json
}

/**
 * GET from IRP API.
 * Returns raw response JSON.
 */
async function irpGet(
  path: string,
  params: Record<string, string>,
  token: string,
  gstin: string,
): Promise<object> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${IRP_BASE_URL}${path}?${qs}`, {
    headers: {
      'client_id': process.env.IRP_CLIENT_ID!,
      'client_secret': process.env.IRP_CLIENT_SECRET!,
      'Gstin': gstin,
      'user_name': process.env.IRP_USERNAME!,
      'AuthToken': token,
    },
  })
  if (!res.ok) throw new Error(`IRP GET ${path} failed: ${res.status}`)
  const json = await res.json() as {
    Status: string
    Data?: string
    ErrorDetails?: unknown[]
  }
  if (json.Status !== '1') throw new Error(`IRP error: ${JSON.stringify(json)}`)
  return json
}

/**
 * Computes the deterministic IRN hash for error 2150 recovery.
 * SHA256(SellerGSTIN + DocNo + DocType + FY) returned as lowercase hex.
 */
function computeIrnHash(
  gstin: string,
  voucher: { voucherNo: string; date: Date },
): string {
  const fy =
    voucher.date.getMonth() >= 3
      ? `${voucher.date.getFullYear()}-${String(voucher.date.getFullYear() + 1).slice(2)}`
      : `${voucher.date.getFullYear() - 1}-${String(voucher.date.getFullYear()).slice(2)}`
  const input = `${gstin}${voucher.voucherNo}INV${fy}`
  const md = forge.md.sha256.create()
  md.update(input, 'utf8')
  return md.digest().toHex()
}

/**
 * Persists IRN result to voucher row and writes audit log.
 * Always in a prisma.$transaction for atomicity.
 */
async function storeIrn(
  voucherId: string,
  companyId: string,
  result: IrnResult,
  userId?: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.voucher.update({
      where: { id: voucherId },
      data: {
        irn: result.irn,
        irnQrCode: result.signedQrCode,
        irnGeneratedAt: new Date(),
        eWayBillNo: result.ewbNo ?? undefined,
        eWayBillValidUntil: result.ewbValidUntil ?? undefined,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        userId: userId ?? 'system',
        entity: 'Voucher',
        entityId: voucherId,
        action: 'UPDATE',
        newValue: { irn: result.irn, ackNo: result.ackNo } as object,
      },
    }),
  ])
}

/**
 * Records each IRP attempt (success or failure) to einvoice_logs.
 * Provides full request/response JSON for debugging and compliance auditing.
 */
async function logIrpAttempt(
  voucherId: string,
  companyId: string,
  status: 'SUCCESS' | 'FAILED',
  errorMsg?: string,
  requestJson?: object,
  responseJson?: object,
): Promise<void> {
  // CR-02: sanitise responseJson -- strip SignedQRCode JWT (sensitive) before persisting
  const safeResponse = responseJson
    ? {
        Irn: (responseJson as Record<string, unknown>)['Irn'],
        AckNo: (responseJson as Record<string, unknown>)['AckNo'],
        EwbNo: (responseJson as Record<string, unknown>)['EwbNo'],
      }
    : undefined

  await prisma.eInvoiceLog.create({
    data: {
      companyId,
      voucherId,
      status,
      errorMsg,
      requestJson: requestJson as never,
      responseJson: safeResponse as never,
    },
  })
}
