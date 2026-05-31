'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Company {
  id: string
  name: string
  gstin: string | null
  fyStart: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getCurrentFY(): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  // Indian FY: April (4) to March (3)
  if (currentMonth >= 4) {
    return `${currentYear}-${String(currentYear + 1).slice(2)}`
  }
  return `${currentYear - 1}-${String(currentYear).slice(2)}`
}

export default function CompanySelectPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  async function handleSelectCompany(companyId: string) {
    setSelectingId(companyId)
    try {
      // Verify access server-side before updating JWT (T-04-03 mitigation)
      const verifyRes = await fetch('/api/v1/auth/select-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })

      if (!verifyRes.ok) {
        setSelectingId(null)
        return
      }

      // select-company route re-issues the JWT cookie with the new companyId
      router.push('/dashboard')
      router.refresh()
    } catch {
      setSelectingId(null)
    }
  }

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch('/api/v1/auth/user-companies')
        if (!res.ok) throw new Error('Failed to load companies')
        const data = await res.json()
        const list: Company[] = data.companies ?? []
        setCompanies(list)

        // Auto-redirect if only one company — no need to show the picker
        if (list.length === 1) {
          await handleSelectCompany(list[0].id)
          return
        }
      } catch {
        // Fallback: redirect to login
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    fetchCompanies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    )
  }

  const fy = getCurrentFY()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <p className="text-purple-600 font-bold text-xl mb-2">PremGiri Books</p>

      {/* Heading — UI-SPEC 9.2 exact copy */}
      <h1 className="text-xl font-semibold text-gray-900 mb-1">
        Choose a company
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        You have access to multiple companies
      </p>

      {/* Company card grid — D-05 layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl w-full">
        {companies.map((company) => {
          const isSelecting = selectingId === company.id

          return (
            <button
              key={company.id}
              onClick={() => handleSelectCompany(company.id)}
              disabled={selectingId !== null}
              className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 text-left hover:border-purple-300 hover:shadow-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-600 outline-none active:scale-[0.98] disabled:opacity-60"
            >
              {/* Company avatar (initials) — UI-SPEC 6.2 */}
              <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex items-center justify-center">
                {isSelecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  getInitials(company.name)
                )}
              </div>

              {/* Company name */}
              <p className="text-base font-semibold text-gray-900 mt-3 truncate">
                {company.name}
              </p>

              {/* GSTIN — show "No GSTIN" if null (UI-SPEC 9.2) */}
              <p className="text-sm text-gray-500 mt-0.5 truncate">
                {company.gstin ?? (
                  <span className="text-gray-400">No GSTIN</span>
                )}
              </p>

              {/* FY badge — bg-purple-50 text-purple-600 per UI-SPEC 6.2 */}
              <span className="inline-flex mt-2 items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-600 font-medium">
                FY {fy}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sign out link — UI-SPEC 9.2 exact copy */}
      <button
        onClick={async () => {
          await fetch('/api/v1/auth/logout', { method: 'POST' })
          router.push('/login')
        }}
        className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Sign out
      </button>
    </div>
  )
}
