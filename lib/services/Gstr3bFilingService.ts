/**
 * Gstr3bFilingService — GSP stub interface for future GSTR-3B filing via API.
 *
 * This service defines the interface for when a GSP (GST Suvidha Provider) license
 * is obtained. Until then, GSTR-3B export is handled via:
 *   POST /api/v1/gst/gstr3b/export
 *
 * Neither method is available without a valid GSP license.
 */

export interface IGstr3bFilingService {
  /**
   * Export GSTR-3B JSON as a Buffer for the given period.
   * Use POST /api/v1/gst/gstr3b/export instead.
   */
  exportJson(companyId: string, period: string): Promise<Buffer>

  /**
   * File GSTR-3B via GSP API (requires GSP license + OTP from IRP).
   * Returns the Acknowledgment Reference Number (ARN) and timestamp on success.
   */
  fileViaApi(companyId: string, period: string, otp: string): Promise<{ arn: string; timestamp: string }>
}

export class Gstr3bFilingService implements IGstr3bFilingService {
  async exportJson(_companyId: string, _period: string): Promise<Buffer> {
    throw new Error('Use POST /api/v1/gst/gstr3b/export instead')
  }

  async fileViaApi(_companyId: string, _period: string, _otp: string): Promise<{ arn: string; timestamp: string }> {
    throw new Error('GSTR-3B API filing requires a GSP license — not available in this version')
  }
}
