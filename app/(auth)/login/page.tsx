'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, Loader2 } from 'lucide-react'
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

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'This field is required'),
})
type LoginInput = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setIsLoading(true)
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (result?.error) {
        // D-03: Toast error, bottom-right — NOT inline (per UI-SPEC 9.1)
        toast.error('Incorrect email or password. Please try again.', {
          duration: 4000,
        })
        return
      }

      // Redirect to company-select (handles multi-company) or dashboard
      router.push('/company-select')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // D-01: Split-screen layout — no topbar, no sidebar (outside (app) route group)
    <div className="flex h-screen">
      {/* LEFT PANEL — bg-purple-600 per D-01, D-02 */}
      <div className="hidden md:flex w-1/2 bg-purple-600 flex-col justify-between p-10">
        {/* Logo */}
        <div>
          <span className="text-white text-2xl font-bold">PremGiri Books</span>
        </div>

        {/* Center content */}
        <div>
          {/* Tagline — exact copy from UI-SPEC 9.1 */}
          <p className="text-white text-xl font-semibold mt-8 max-w-xs leading-snug">
            Accounting made simple for Indian businesses
          </p>

          {/* 3 bullet points per D-02 — exact text from UI-SPEC 9.1 */}
          <ul className="mt-8 space-y-3">
            {[
              'GST filing in minutes, not hours',
              'TallyPrime-style ledgers and vouchers',
              'Built for any Indian business',
            ].map((bullet) => (
              <li key={bullet} className="flex items-center">
                <CheckCircle className="h-4 w-4 text-purple-300 mr-2 shrink-0" />
                <span className="text-sm text-purple-100">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-purple-300">© 2025 PremGiri Books</p>
      </div>

      {/* RIGHT PANEL — bg-white per D-01 */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center">
        <div className="w-full max-w-sm px-8">
          {/* Wordmark — per UI-SPEC 9.1 */}
          <p className="text-xl font-bold text-gray-900 mb-1">PremGiri Books</p>
          <p className="text-sm text-gray-500 mb-8">Sign in to your account</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Email address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="accountant@company.com"
                        autoComplete="email"
                        className="border-gray-200"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="border-gray-200"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />

              {/* D-04: No register link, no forgot password per UI-SPEC 9.1 */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </Form>

          <p className="text-xs text-gray-400 text-center mt-8">
            © 2025 PremGiri Books
          </p>
        </div>
      </div>
    </div>
  )
}
