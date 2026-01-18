import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { UserRole } from "@prisma/client"
import { audit, AuditAction } from "./audit"
import { logger } from "./logger"

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
    lastActivity?: number
    error?: string
  }
}

// Session configuration constants
const SESSION_MAX_AGE = 24 * 60 * 60 // 24 hours in seconds
const SESSION_UPDATE_AGE = 60 * 60 // Update session every hour

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Configure JWT with secure settings
  jwt: {
    maxAge: SESSION_MAX_AGE,
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
          // Audit failed login attempt
          audit(AuditAction.LOGIN_FAILED, {
            metadata: { email: credentials.email.toLowerCase(), reason: "invalid_password" },
          })
          throw new Error("Invalid email or password")
        }

        // Audit successful login
        audit(AuditAction.LOGIN_SUCCESS, {
          userId: user.id,
          organizationId: user.organizationId || undefined,
        })

        logger.info("User logged in", { userId: user.id, email: user.email })

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
  events: {
    async signOut({ token }) {
      if (token?.id) {
        audit(AuditAction.LOGOUT, {
          userId: token.id as string,
          organizationId: (token.organizationId as string) || undefined,
        })
        logger.info("User logged out", { userId: token.id })
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId
        token.lastActivity = Date.now()
      }

      // On session update, refresh user data periodically
      if (trigger === "update" || (token.lastActivity && Date.now() - (token.lastActivity as number) > SESSION_UPDATE_AGE * 1000)) {
        try {
          // Verify user still exists and is active
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { status: true, role: true, organizationId: true },
          })

          if (!dbUser || dbUser.status !== "ACTIVE") {
            // User is no longer active, invalidate token
            return { ...token, error: "UserInactive" }
          }

          // Update token with latest role/org (in case it changed)
          token.role = dbUser.role
          token.organizationId = dbUser.organizationId
          token.lastActivity = Date.now()
        } catch (error) {
          logger.error("Error refreshing user session", error)
        }
      }

      return token
    },
    async session({ session, token }) {
      // Handle token errors (user deactivated, etc.)
      if (token?.error === "UserInactive") {
        // Return an invalid session that will trigger re-authentication
        return {
          ...session,
          error: "UserInactive",
          expires: new Date(0).toISOString(),
        }
      }

      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.organizationId = token.organizationId
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
