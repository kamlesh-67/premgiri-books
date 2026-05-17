import type { NextAuthConfig } from 'next-auth'

// ─── NextAuth Type Extensions ────────────────────────────────────────────────
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

/**
 * Edge-safe NextAuth config — no Node.js-only imports (no ioredis, pg, Prisma).
 * Used by middleware.ts to avoid bundling Node.js modules into the Edge Runtime.
 * The full auth config (with CredentialsProvider + blocklist) lives in auth.ts.
 */
export const authConfig = {
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger, session }: any) {
      // Initial sign-in: populate token fields from authorize() return value.
      // This block only runs in Node.js context (sign-in hits /api/auth/callback/credentials).
      if (user) {
        token.userId = user.id as string
        token.companyId = user.companyId as string
        token.roleId = (user.roleId as string | null) ?? null
        token.uiMode = (user.uiMode as 'simple' | 'advanced') ?? 'simple'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.permissions = (user as any).permissions ?? {}
      }

      // Mode toggle (Simple ↔ Advanced) — no external dependencies
      if (trigger === 'update' && session?.uiMode) {
        token.uiMode = session.uiMode as 'simple' | 'advanced'
      }

      // Company-select: update companyId on token.
      // Prisma re-fetch for roleId/permissions is handled in auth.ts (Node.js only).
      if (trigger === 'update' && session?.companyId) {
        token.companyId = session.companyId as string
      }

      return token
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      session.user.id = token.userId as string
      session.user.companyId = token.companyId as string
      session.user.roleId = token.roleId as string | null
      session.user.uiMode = token.uiMode as 'simple' | 'advanced'
      session.user.permissions = (token.permissions as Record<string, string[]>) ?? {}
      return session
    },
  },

  providers: [],
} satisfies NextAuthConfig
