'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

const companySchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(200),
  gstin: z
    .string()
    .optional()
    .refine((val) => !val || val === '' || GSTIN_REGEX.test(val), {
      message: 'Invalid GSTIN format',
    })
    .transform((val) => val ?? ''),
  pan: z
    .string()
    .optional()
    .refine((val) => !val || val === '' || PAN_REGEX.test(val), {
      message: 'Invalid PAN format',
    })
    .transform((val) => val ?? ''),
  address: z.string().max(500).optional().transform((val) => val ?? ''),
  stateCode: z.string().length(2, 'State code must be 2 characters'),
  fyStart: z.number().int().min(1).max(12).default(4),
})

const adminSchema = z
  .object({
    adminPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.adminPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type CompanyFormData = z.infer<typeof companySchema>
type AdminFormData = z.infer<typeof adminSchema>
type WizardStep = 'company' | 'admin'

const MONTH_NAMES: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
}

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>('company')
  const [companyData, setCompanyData] = useState<CompanyFormData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const companyForm = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: '',
      gstin: '',
      pan: '',
      address: '',
      stateCode: '',
      fyStart: 4,
    },
  })

  const adminForm = useForm<AdminFormData>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      adminPassword: '',
      confirmPassword: '',
    },
  })

  const gstin = companyForm.watch('gstin')

  useEffect(() => {
    if (gstin && gstin.length >= 2) {
      companyForm.setValue('stateCode', gstin.substring(0, 2))
    }
  }, [gstin])

  function handleCompanyNext(data: CompanyFormData) {
    setCompanyData(data)
    setStep('admin')
  }

  async function handleAdminSubmit(data: AdminFormData) {
    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...companyData,
          adminPassword: data.adminPassword,
        }),
      })

      if (!res.ok) {
        toast.error('Setup failed. Please try again.', { duration: 4000 })
        return
      }

      router.push('/dashboard')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* LEFT PANEL */}
      <div className="hidden md:flex w-1/2 bg-purple-600 flex-col justify-between p-10">
        <div>
          <span className="text-white text-2xl font-bold">PremGiri Books</span>
        </div>
        <div>
          <p className="text-white text-xl font-semibold mt-8 max-w-xs leading-snug">
            Welcome to PremGiri Books
          </p>
          <p className="text-sm text-purple-200 mt-2">
            Let&apos;s set up your company
          </p>
        </div>
        <p className="text-xs text-purple-300">© 2025 PremGiri Books</p>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center">
        <div className="w-full max-w-sm px-8">
          <p className="text-xs text-gray-400 mb-1">
            Step {step === 'company' ? 1 : 2} of 2
          </p>
          <p className="text-xl font-bold text-gray-900 mb-1">
            {step === 'company' ? 'Set up your company' : 'Create admin account'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {step === 'company'
              ? 'Enter your business details to get started'
              : 'Create the administrator login for this installation'}
          </p>

          {step === 'company' ? (
            <Form {...companyForm}>
              <form
                onSubmit={companyForm.handleSubmit(handleCompanyNext)}
                className="space-y-4"
              >
                <FormField
                  control={companyForm.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Company Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Sharma Trading Co."
                          className="border-gray-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={companyForm.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        GSTIN (optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="27AAPFU0939F1ZV"
                          className="border-gray-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={companyForm.control}
                  name="pan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        PAN (optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="AAPFU0939F"
                          className="border-gray-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={companyForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Address (optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Main Street, Mumbai"
                          className="border-gray-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={companyForm.control}
                  name="stateCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        State Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="27"
                          maxLength={2}
                          className="border-gray-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={companyForm.control}
                  name="fyStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Financial Year Start Month
                      </FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(Number(val))}
                        defaultValue={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger className="border-gray-200">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (month) => (
                              <SelectItem key={month} value={String(month)}>
                                {MONTH_NAMES[month]} ({month})
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Next →
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...adminForm}>
              <form
                onSubmit={adminForm.handleSubmit(handleAdminSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={adminForm.control}
                  name="adminPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Admin Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="border-gray-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={adminForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="border-gray-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />

                <p className="text-xs text-gray-400 mt-1">
                  Email: admin@premgiribooks.com (fixed)
                </p>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setStep('company')}
                  className="w-full mb-2"
                >
                  ← Back
                </Button>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Set Up PremGiri Books'
                  )}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  )
}
