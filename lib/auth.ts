import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authDb } from '@/lib/authDb'
import { z } from 'zod'
import { isUserBlocked } from '@/lib/redis'

// ─── NextAuth Type Extensions ───────────────────────────────────────────────
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      companyId: string
      roleId: string | null
      uiMode: 'simple' | 'advanced'
      permissions: Record<string, string[]>
    }
  }
}

// ─── Credentials Validation Schema ──────────────────────────────────────────
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ─── NextAuth Config ─────────────────────────────────────────────────────────
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Validate input shape first
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        // IMPORTANT: Use authDb (unextended) — main prisma throws TenantScopeError
        // without companyId, but we don't know companyId yet during login.
        // findFirst returns any User row with this email (first company they belong to).
        // If user belongs to multiple companies, company-select page handles the switch.
        const user = await authDb.user.findFirst({
          where: { email: parsed.data.email, isActive: true },
          select: {
            id: true,
            email: true,
            name: true,
            companyId: true,
            roleId: true,
            uiMode: true,
            passwordHash: true,
            isActive: true,
          },
        })

        if (!user) return null

        const isValidPassword = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        )
        if (!isValidPassword) return null

        // Update lastLogin — non-blocking; failure does not block auth (T-09-01-02)
        try {
          await authDb.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          })
        } catch {
          // Intentionally swallow — lastLogin update must never block sign-in
        }

        // Fetch role permissions for this user
        const role = user.roleId
          ? await authDb.role.findUnique({
              where: { id: user.roleId },
              select: { permissions: true },
            })
          : null

        // Return user data — companyId from first found User row
        // This may be overridden by /company-select if user has multiple companies
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          roleId: user.roleId,
          uiMode: user.uiMode as 'simple' | 'advanced',
          permissions: (role?.permissions as Record<string, string[]>) ?? {},
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger, session }: any) {
      // ADM-03: Blocklist check — runs on EVERY request, before any other logic.
      // Returning null invalidates the session; next request returns 401.
      if (token?.sub) {
        const blocked = await isUserBlocked(token.sub)
        if (blocked) return null
      }

      // Initial sign-in: populate token from authorize() return value
      if (user) {
        token.userId = user.id as string
        token.companyId = user.companyId as string
        token.roleId = (user.roleId as string | null) ?? null
        token.uiMode = (user.uiMode as 'simple' | 'advanced') ?? 'simple'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.permissions = (user as any).permissions ?? {}
      }

      // Mode toggle update: user switched Simple ↔ Advanced
      if (trigger === 'update' && session?.uiMode) {
        token.uiMode = session.uiMode as 'simple' | 'advanced'
      }

      // Company-select update: user chose a different company
      // Called via: useSession().update({ companyId: selectedCompanyId })
      if (trigger === 'update' && session?.companyId) {
        token.companyId = session.companyId as string

        // Re-fetch user row for the newly selected company to get correct roleId + uiMode
        const userForCompany = await authDb.user.findFirst({
          where: {
            email: token.email as string,
            companyId: session.companyId as string,
            isActive: true,
          },
          select: { id: true, roleId: true, uiMode: true },
        })

        if (userForCompany) {
          token.userId = userForCompany.id
          token.roleId = userForCompany.roleId ?? null
          token.uiMode = (userForCompany.uiMode as 'simple' | 'advanced') ?? 'simple'

          // Re-fetch permissions for the new company's role
          const roleForCompany = userForCompany.roleId
            ? await authDb.role.findUnique({
                where: { id: userForCompany.roleId },
                select: { permissions: true },
              })
            : null
          token.permissions = (roleForCompany?.permissions as Record<string, string[]>) ?? {}
        }
      }

      return token
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      // Map JWT token fields to session.user
      session.user.id = token.userId as string
      session.user.companyId = token.companyId as string
      session.user.roleId = token.roleId as string | null
      session.user.uiMode = token.uiMode as 'simple' | 'advanced'
      session.user.permissions = (token.permissions as Record<string, string[]>) ?? {}
      return session
    },
  },
})
