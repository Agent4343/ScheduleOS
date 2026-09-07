import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { UserRole } from "@prisma/client"
import { rateLimit, rateLimitPresets } from "./rate-limit"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      role: UserRole
      organizationId: string | null
      image?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name: string | null
    role: UserRole
    organizationId: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    organizationId: string | null
    /** Epoch ms of the last time role/status/org were re-read from the DB */
    refreshedAt?: number
    /** Set when the account no longer exists or is not ACTIVE */
    invalidated?: boolean
  }
}

/** How long a session may live before the user must sign in again. */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

/**
 * How often the JWT re-reads role, status and organization from the database.
 * A terminated or demoted user is locked out within this window instead of
 * keeping their old claims until the token expires.
 */
export const CLAIMS_REFRESH_INTERVAL_MS = 60 * 1000

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }

        // Apply rate limiting based on email
        const rateLimitResult = await rateLimit(`login:${credentials.email.toLowerCase()}`, rateLimitPresets.auth)
        
        if (!rateLimitResult.success) {
          throw new Error("Too many login attempts. Please try again later.")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            organizationId: true,
            status: true,
          },
        })

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password")
        }

        if (user.status !== "ACTIVE") {
          throw new Error("Account is not active")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error("Invalid email or password")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fresh sign-in: claims come straight from authorize()
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId
        token.refreshedAt = Date.now()
        token.invalidated = false
        return token
      }

      if (!token.id || token.invalidated) {
        return token
      }

      // Periodically re-read the claims so role changes, terminations and
      // deletions take effect without waiting for the token to expire.
      const stale =
        !token.refreshedAt || Date.now() - token.refreshedAt > CLAIMS_REFRESH_INTERVAL_MS
      if (!stale) {
        return token
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { organizationId: true, role: true, status: true },
      })

      if (!dbUser || dbUser.status !== "ACTIVE") {
        // Account gone or deactivated: strip the claims so requireAuth()
        // returns 401 and the middleware sends the user back to /login.
        token.invalidated = true
        token.organizationId = null
        return token
      }

      token.organizationId = dbUser.organizationId
      token.role = dbUser.role
      token.refreshedAt = Date.now()
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.organizationId = token.invalidated ? null : token.organizationId
      }
      return session
    },
  },
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
