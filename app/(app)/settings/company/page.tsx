'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { usePermission } from '@/hooks/usePermission'
import { useUiMode } from '@/hooks/useUiMode'

type CompanyResponse = {
  id: string
  name: string
  gstin: string | null
  pan: string | null
  stateCode: string
  address: string | null
  fyStart: number
  logoUrl: string | null
  defaultBankLedgerId: string | null
}

type BankLedgerOption = {
  id: string
  name: string
  bankName: string | null
  bankAccount: string | null
  ifsc: string | null
}

export default function CompanyProfilePage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [defaultBankLedgerId, setDefaultBankLedgerId] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)

  const isAdmin = usePermission('settings', 'admin')
  const { mode } = useUiMode()
  const cardTitle = mode === 'simple' ? 'Smart Search' : 'Data Intelligence'
  const buildLabel = mode === 'simple' ? 'Rebuild Search' : 'Build Search Index'

  const { data, isLoading } = useQuery<CompanyResponse>({
    queryKey: ['company'],
    queryFn: () => fetch('/api/v1/company').then((r) => r.json()),
  })

  const { data: bankLedgers } = useQuery<BankLedgerOption[]>({
    queryKey: ['ledgers', 'bank'],
    queryFn: () => fetch('/api/v1/masters/ledgers?type=bank').then((r) => r.json()),
  })

  useEffect(() => {
    if (data) {
      setName(data.name ?? '')
      setAddress(data.address ?? '')
      setDefaultBankLedgerId(data.defaultBankLedgerId ?? '')
    }
  }, [data])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setFileError('Invalid file type — please choose a PNG, JPG, or WebP image.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setFileError('File is too large — please choose an image under 2MB.')
      return
    }

    setFileError(null)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Upload logo first if a new file was selected
      if (logoFile) {
        const formData = new FormData()
        formData.append('file', logoFile)
        const logoRes = await fetch('/api/v1/company/logo', {
          method: 'POST',
          body: formData,
        })
        if (!logoRes.ok) {
          const err = await logoRes.json().catch(() => ({ error: 'Logo upload failed' }))
          throw new Error(err.error ?? 'Logo upload failed')
        }
      }

      // Patch company profile
      const profileRes = await fetch('/api/v1/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, defaultBankLedgerId: defaultBankLedgerId || null }),
      })
      if (!profileRes.ok) {
        const err = await profileRes.json().catch(() => ({ error: 'Failed to save profile' }))
        throw new Error(err.error ?? 'Failed to save profile')
      }

      // Clear the local logo file state and invalidate cache so topbar re-fetches
      setLogoFile(null)
      setLogoPreview(null)
      await queryClient.invalidateQueries({ queryKey: ['company'] })
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  // Determine which logo image source to show
  const logoSrc = logoPreview ?? data?.logoUrl ?? null

  const onBuild = async () => {
    setIsBuilding(true)
    try {
      const r = await fetch('/api/v1/embeddings/trigger', { method: 'POST' })
      if (!r.ok) throw new Error('trigger failed')
      toast.success('Search index build started. It will complete in the background.')
    } catch {
      toast.error('Failed to start search index build. Try again.')
      setIsBuilding(false)
    }
    // Note: do NOT clear isBuilding on success — status remains 'Building now...' until next page visit (v1 limitation)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Company Profile"
        subtitle="Manage your company information and branding"
      />

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading company details...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Company Information */}
          <div className="lg:col-span-2">
            <SectionCard title="Company Information">
              <div className="space-y-4">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>

                {/* GSTIN — read-only */}
                <div className="space-y-1.5">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <div className="relative">
                    <Input
                      id="gstin"
                      value={data?.gstin ?? ''}
                      disabled
                      className="text-gray-400 pr-8"
                      placeholder="Not set"
                    />
                    <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    GSTIN cannot be changed after company registration. Contact support if there&apos;s an error.
                  </p>
                </div>

                {/* PAN — read-only */}
                <div className="space-y-1.5">
                  <Label htmlFor="pan">PAN</Label>
                  <div className="relative">
                    <Input
                      id="pan"
                      value={data?.pan ?? ''}
                      disabled
                      className="text-gray-400 pr-8"
                      placeholder="Not set"
                    />
                    <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    PAN cannot be changed after company registration. Contact support if there&apos;s an error.
                  </p>
                </div>

                {/* State Code — read-only */}
                <div className="space-y-1.5">
                  <Label htmlFor="stateCode">State Code</Label>
                  <div className="relative">
                    <Input
                      id="stateCode"
                      value={data?.stateCode ?? ''}
                      disabled
                      className="text-gray-400 pr-8"
                      placeholder="Not set"
                    />
                    <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    State code cannot be changed after company registration. Contact support if there&apos;s an error.
                  </p>
                </div>

                {/* Registered Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="address">Registered Address</Label>
                  <Textarea
                    id="address"
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter registered address"
                  />
                </div>

                {/* Default Bank Account — used on printed invoices */}
                <div className="space-y-1.5">
                  <Label htmlFor="defaultBankLedger">Default Bank Account (for Invoices)</Label>
                  <select
                    id="defaultBankLedger"
                    value={defaultBankLedgerId}
                    onChange={(e) => setDefaultBankLedgerId(e.target.value)}
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                  >
                    <option value="">— None —</option>
                    {(bankLedgers ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.bankName ? `(${l.bankName})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    This ledger&apos;s bank name, account number, and IFSC print on sales invoice PDFs.
                    Only ledgers with bank details filled in appear here — add them under Masters &gt; Ledgers.
                  </p>
                </div>

                {/* Status messages */}
                {saveError && (
                  <p className="text-sm text-red-600">{saveError}</p>
                )}
                {saveSuccess && (
                  <p className="text-sm text-green-600">Company profile saved successfully.</p>
                )}

                {/* Save button */}
                <Button
                  onClick={handleSave}
                  className="w-full mt-2"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Company Profile'}
                </Button>
              </div>
            </SectionCard>
          </div>

          {/* Right: Company Logo */}
          <div className="lg:col-span-1">
            <SectionCard title="Company Logo">
              <div className="flex flex-col items-center gap-4">
                {/* Logo preview */}
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoSrc}
                    alt="Company logo"
                    className="w-16 h-16 rounded-lg object-contain border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-purple-100 text-purple-700 text-lg font-semibold flex items-center justify-center">
                    {data?.name?.slice(0, 2).toUpperCase() ?? 'PG'}
                  </div>
                )}

                {/* Upload button */}
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  Upload Logo
                </Button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* File error */}
                {fileError && (
                  <p className="text-xs text-red-600 text-center">{fileError}</p>
                )}

                {/* Constraints label */}
                <p className="text-xs text-gray-400 text-center">
                  PNG, JPG or WebP · Max 2MB · Recommended 200×200px
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Data Intelligence / Smart Search — Admin only */}
      {isAdmin && (
        <SectionCard title={cardTitle}>
          <p className="text-sm text-gray-600">
            Power the smart search and AI insights by building your search index. Run this once after setup, then it updates automatically.
          </p>

          <div className="flex justify-between items-center mt-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Search Index</p>
              <p className="text-xs text-gray-400">
                {isBuilding ? 'Building now...' : 'Not yet built'}
              </p>
            </div>
            <Button size="sm" onClick={onBuild} disabled={isBuilding}>
              {isBuilding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Building...
                </>
              ) : (
                buildLabel
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            This may take a few minutes for large datasets. You can navigate away — it runs in the background.
          </p>
        </SectionCard>
      )}
    </div>
  )
}
