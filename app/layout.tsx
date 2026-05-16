import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import { Providers } from '@/components/providers/Providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'PremGiri Books',
  description: 'GST Accounting & Business Management for Indian businesses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <PostHogProvider>
          <Providers>
            {children}
          </Providers>
        </PostHogProvider>
      </body>
    </html>
  )
}
