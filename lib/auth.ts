import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authDb } from '@/lib/authDb'
import { z } from 'zod'
import { isUserBlocked } from '@/lib/redis'
import { authConfig } from '@/lib/auth.config'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        // IMPORTANT: Use authDb (unextended) — main prisma throws TenantScopeError
        // without companyId, but we don't know companyId yet during login.
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

        const role = user.roleId
          ? await authDb.role.findUnique({
              where: { id: user.roleId },
              select: { permissions: true },
            })
          : null

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

  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger, session }: any) {
      // ADM-03: Blocklist check — runs on every Node.js request.
      // Returning null invalidates the session; next request returns 401.
      if (token?.sub) {
        const blocked = await isUserBlocked(token.sub)
        if (blocked) return null
      }

      // Delegate base token population to the edge-safe config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base = await (authConfig.callbacks.jwt as any)({ token, user, trigger, session })
      if (!base) return null

      // Company-select: re-fetch roleId + permissions from Prisma (Node.js only).
      // The base config already updated companyId; here we fix the dependent fields.
      if (trigger === 'update' && session?.companyId) {
        const userForCompany = await authDb.user.findFirst({
          where: {
            email: token.email as string,
            companyId: session.companyId as string,
            isActive: true,
          },
          select: { id: true, roleId: true, uiMode: true },
        })

        if (userForCompany) {
          base.userId = userForCompany.id
          base.roleId = userForCompany.roleId ?? null
          base.uiMode = (userForCompany.uiMode as 'simple' | 'advanced') ?? 'simple'

          const roleForCompany = userForCompany.roleId
            ? await authDb.role.findUnique({
                where: { id: userForCompany.roleId },
                select: { permissions: true },
              })
            : null
          base.permissions = (roleForCompany?.permissions as Record<string, string[]>) ?? {}
        }
      }

      return base
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (authConfig.callbacks.session as any)({ session, token })
    },
  },
})
