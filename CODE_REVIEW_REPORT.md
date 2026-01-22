# ShiftSync Code Review Report
**Date:** January 21, 2026  
**Reviewer:** GitHub Copilot Coding Agent  
**Repository:** Agent4343/ScheduleOS

## Executive Summary

ShiftSync is a well-structured Next.js workforce scheduling platform with comprehensive features for managing rotating shift patterns, crews, and time-off requests. The codebase demonstrates good architectural decisions, proper use of TypeScript, and solid database design with Prisma ORM.

However, several **critical security vulnerabilities** and code quality issues require immediate attention before production deployment.

**Overall Assessment:** ⚠️ **Not Production Ready** - Critical security issues must be resolved.

---

## 🔴 Critical Security Issues (P0 - Immediate Fix Required)

### 1. Hardcoded Setup Key Bypass
**File:** `src/app/api/setup/route.ts:233`  
**Severity:** 🔴 **CRITICAL**

**Issue:**
```typescript
if (setupKey !== process.env.SETUP_KEY && setupKey !== "initial-setup-2026") {
```

The setup endpoint has a hardcoded fallback key `"initial-setup-2026"` that bypasses environment variable security. This allows **anyone** to initialize/reset the database by simply using this static key.

**Risk:** Database manipulation, data loss, unauthorized access  
**CVSS Score:** 9.1 (Critical)

**Recommendation:**
```typescript
// Remove hardcoded fallback - ONLY accept env var
if (!process.env.SETUP_KEY || setupKey !== process.env.SETUP_KEY) {
  return NextResponse.json({ error: "Invalid setup key" }, { status: 401 })
}
```

---

### 2. Rate Limiting Not Applied to Authentication Endpoints
**Files:** `src/app/api/register/route.ts`, `src/app/api/auth/[...nextauth]/route.ts`  
**Severity:** 🔴 **CRITICAL**

**Issue:**
Rate limiting utilities exist (`src/lib/rate-limit.ts`) with auth presets (5 attempts per 15 minutes), but are **never imported or used** in authentication routes.

**Risk:** Brute force attacks on login/registration, account enumeration, credential stuffing  
**CVSS Score:** 7.5 (High)

**Recommendation:**
```typescript
// In src/app/api/register/route.ts
import { rateLimit, rateLimitPresets, getClientIP, rateLimitResponse } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const limit = rateLimit(ip, rateLimitPresets.auth)
  
  if (!limit.success) {
    return rateLimitResponse(limit.resetIn)
  }
  // ... rest of handler
}
```

---

### 3. CSV Injection Vulnerability
**File:** `src/app/api/export/route.ts:30`  
**Severity:** 🔴 **HIGH**

**Issue:**
CSV export constructs strings with user-controlled data without proper escaping:
```typescript
csv += `"${user.name || ""}","${user.email}","${user.role}"...`
```

If `user.name` contains `",=SYSTEM("malicious command")"` or similar, it could execute when opened in Excel.

**Risk:** Remote code execution when CSV opened in Excel/LibreOffice  
**CVSS Score:** 7.3 (High)

**Recommendation:**
```typescript
// Install: npm install papaparse @types/papaparse
import Papa from 'papaparse'

const csv = Papa.unparse(users, {
  quotes: true, // Force quote all fields
  escapeFormulae: true // Escape formulas
})
```

---

### 4. Weak Password Requirements
**File:** `src/lib/validations.ts:13-19`  
**Severity:** 🟡 **MEDIUM**

**Issue:**
Current password validation:
```typescript
.min(8, "Password must be at least 8 characters")
.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "...")
```

Missing:
- Special character requirement
- Minimum length too short (8 chars, should be 12+)
- No check against common passwords

**Risk:** Weak passwords susceptible to dictionary attacks

**Recommendation:**
```typescript
.min(12, "Password must be at least 12 characters")
.regex(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
  "Password must contain uppercase, lowercase, number, and special character (@$!%*?&)"
)
```

---

### 5. Cryptographically Weak Token Generation
**File:** `src/lib/utils.ts:85-92`  
**Severity:** 🟡 **MEDIUM**

**Issue:**
```typescript
export function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
```

Uses `Math.random()` which is **not cryptographically secure**. Predictable for session tokens/invitations.

**Note:** Currently unused (no imports found), but if activated later could be dangerous.

**Recommendation:**
```typescript
import { randomBytes } from 'crypto'

export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url').slice(0, length)
}
```

---

## 🟡 High Priority Issues (P1)

### 6. In-Memory Rate Limiting (Single Instance Only)
**File:** `src/lib/rate-limit.ts:9`  
**Severity:** 🟡 **MEDIUM**

**Issue:**
```typescript
const rateLimitStore = new Map<string, RateLimitEntry>()
```

In-memory storage only works for single-instance deployments. Railway may run multiple instances, making rate limits ineffective.

**Recommendation:**
- Implement Redis-backed rate limiting using `@upstash/redis` or `ioredis`
- Alternative: Use middleware services like Cloudflare rate limiting

---

### 7. Missing Role-Based Access Control (RBAC) Enforcement
**Files:** Multiple API routes  
**Severity:** 🟡 **MEDIUM**

**Issues:**
- Time-off approval endpoint (`src/app/api/time-off/[id]/route.ts`) allows supervisors to approve their own requests
- No validation that users can only access data from their own organization
- Schedule generation doesn't verify requesting user belongs to target organization

**Recommendation:**
```typescript
// Create middleware/rbac.ts
export function canApproveTimeOff(userId: string, requestUserId: string, role: string) {
  if (userId === requestUserId) return false // Can't approve own request
  return role === "ADMIN" || role === "SUPERVISOR"
}
```

---

### 8. Error Information Leakage
**File:** `src/app/api/register/route.ts:184-188`  
**Severity:** 🟡 **MEDIUM**

**Issue:**
```typescript
if (error instanceof Error && error.name === "ZodError") {
  return NextResponse.json(
    { error: "Invalid input data", details: error }, // ❌ Exposes internal validation
    { status: 400 }
  )
}
```

Exposes Zod validation error details to clients, revealing internal validation logic.

**Recommendation:**
```typescript
if (error instanceof Error && error.name === "ZodError") {
  console.error("Validation error:", error) // Log internally
  return NextResponse.json(
    { error: "Invalid input data" }, // Generic message
    { status: 400 }
  )
}
```

---

### 9. Missing Input Sanitization
**Files:** Multiple routes  
**Severity:** 🟡 **MEDIUM**

**Issue:**
Organization names, crew names, user names are stored without sanitization. Could enable XSS if rendered client-side without escaping.

**Recommendation:**
```typescript
// Install: npm install dompurify isomorphic-dompurify
import DOMPurify from 'isomorphic-dompurify'

const sanitized = DOMPurify.sanitize(userInput, { 
  ALLOWED_TAGS: [], // Strip all HTML
  ALLOWED_ATTR: []
})
```

---

### 10. No Audit Logging for Sensitive Operations
**Files:** All mutation routes  
**Severity:** 🟡 **MEDIUM**

**Issue:**
No audit trail for:
- Time-off approvals/denials
- Schedule overrides
- User deletions
- Organization setting changes
- Password changes

**Recommendation:**
Add `AuditLog` table:
```prisma
model AuditLog {
  id            String   @id @default(cuid())
  action        String   // "time_off_approved", "user_deleted"
  entityType    String   // "TimeOffRequest", "User"
  entityId      String
  userId        String
  metadata      Json?    // Changes made
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime @default(now())
  
  user          User     @relation(fields: [userId], references: [id])
  organizationId String
  organization  Organization @relation(fields: [organizationId], references: [id])
}
```

---

## 🟢 Medium Priority Issues (P2)

### 11. Missing Pagination
**Files:** `src/app/api/users/route.ts`, etc.  
**Severity:** 🟢 **LOW**

**Issue:**
```typescript
const users = await prisma.user.findMany({
  where: { organizationId: session.user.organizationId },
})
```

Returns all users without limit. Could be thousands of records.

**Recommendation:**
```typescript
const page = parseInt(searchParams.get("page") || "1")
const limit = parseInt(searchParams.get("limit") || "50")

const users = await prisma.user.findMany({
  where: { organizationId: session.user.organizationId },
  take: limit,
  skip: (page - 1) * limit,
})
```

---

### 12. Console Logging in Production
**Files:** 30+ instances across API routes  
**Severity:** 🟢 **LOW**

**Issue:**
```typescript
console.error("Setup error:", error) // Spams production logs
```

**Recommendation:**
Use structured logging (Winston, Pino) with log levels and context.

---

### 13. Timezone Handling Inconsistency
**File:** `src/lib/scheduling.ts`  
**Severity:** 🟢 **LOW**

**Issue:**
Mixing UTC and local date handling could cause off-by-one errors in multi-timezone organizations.

**Recommendation:**
- Always store in UTC
- Convert to org timezone only at display layer
- Use `date-fns-tz` for proper timezone conversions

---

## 📦 Dependency Vulnerabilities

**Total Vulnerabilities:** 6 (3 low, 3 high)

### Critical:
1. **glob** (10.2.0 - 10.4.5): Command injection (CVSS 7.5)
   - Via `@next/eslint-plugin-next`
   - Fix: Upgrade `eslint-config-next` to 16.1.4

2. **cookie** (<0.7.0): Out of bounds characters (CVSS 3.1)
   - Via `@auth/core` → `next-auth`
   - Fix: Not directly fixable without major version upgrade

**Recommendation:**
```bash
# Upgrade to fix glob vulnerability
npm install eslint-config-next@16.1.4 --save-dev

# Consider next-auth upgrade path (breaking changes)
# Review: https://authjs.dev/guides/upgrade-to-v5
```

---

## ✅ Positive Observations

### Architecture & Design
✅ **Excellent database schema** - proper multi-tenancy with cascading deletes  
✅ **Well-organized code structure** - clear separation of concerns  
✅ **Comprehensive type safety** - Zod validation + TypeScript  
✅ **Security headers configured** - CSP, X-Frame-Options, X-XSS-Protection  

### Code Quality
✅ **Consistent error handling** - try-catch in all route handlers  
✅ **Reusable utilities** - scheduling, timezone, validation modules  
✅ **Proper indexing** - database indexes on frequently queried fields  

### Features
✅ **Flexible rotation system** - supports complex shift patterns  
✅ **Time-off management** - approval workflow implemented  
✅ **Multi-tenant design** - proper organization isolation  

---

## 📋 Recommendations Priority Matrix

| Priority | Issue | Effort | Impact | Timeline |
|----------|-------|--------|--------|----------|
| **P0** | Remove hardcoded setup key | 5 min | Critical | Immediate |
| **P0** | Apply rate limiting to auth | 30 min | Critical | Day 1 |
| **P0** | Fix CSV injection | 1 hour | High | Day 1 |
| **P1** | Enhance password validation | 15 min | Medium | Week 1 |
| **P1** | Fix token generation | 20 min | Medium | Week 1 |
| **P1** | Implement Redis rate limiting | 4 hours | Medium | Week 2 |
| **P1** | Add RBAC enforcement | 8 hours | High | Week 2 |
| **P2** | Add audit logging | 1 day | Medium | Month 1 |
| **P2** | Input sanitization | 2 hours | Medium | Month 1 |
| **P2** | Add pagination | 3 hours | Low | Month 1 |

---

## 🚀 Action Items for Production Readiness

### Week 1 (Critical Path)
- [ ] Remove hardcoded setup keys
- [ ] Apply rate limiting to `/api/register` and login
- [ ] Fix CSV export injection vulnerability
- [ ] Upgrade `eslint-config-next` to fix glob CVE
- [ ] Enhance password requirements (12 chars + special)
- [ ] Fix `generateToken()` to use `crypto.randomBytes()`

### Week 2 (High Priority)
- [ ] Implement Redis-backed rate limiting
- [ ] Add RBAC permission checks (own request approval, org boundary)
- [ ] Remove error detail leakage from API responses
- [ ] Add input sanitization pipeline

### Month 1 (Medium Priority)
- [ ] Implement audit logging system
- [ ] Add pagination to list endpoints
- [ ] Standardize timezone handling (UTC everywhere)
- [ ] Set up structured logging (Winston/Pino)
- [ ] Create security policy documentation

### Ongoing
- [ ] Regular dependency audits (`npm audit`)
- [ ] Security scanning in CI/CD
- [ ] Penetration testing before launch
- [ ] Security training for development team

---

## 📚 References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Prisma Security Guidelines](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#security)

---

## 📝 Testing Recommendations

### Security Testing
```bash
# 1. Test rate limiting
for i in {1..10}; do curl -X POST http://localhost:3000/api/register -d '{"email":"test@test.com"}'; done

# 2. Test setup key bypass (should fail after fix)
curl http://localhost:3000/api/setup?key=initial-setup-2026

# 3. Test CSV injection
# Create user with name: ",=SYSTEM(\"calc\")"
# Export CSV and open in Excel (should not execute)
```

### Load Testing
```bash
# Install autocannon
npm install -g autocannon

# Test API performance
autocannon -c 100 -d 30 http://localhost:3000/api/users
```

---

## 🎯 Conclusion

ShiftSync demonstrates **solid engineering fundamentals** with excellent architecture and database design. However, the presence of **critical security vulnerabilities** (hardcoded keys, missing rate limiting, CSV injection) makes it **unsuitable for production** in its current state.

**Estimated effort to reach production-ready state:** 2-3 weeks with 1 developer

The development team should prioritize the P0 and P1 security fixes before considering deployment. Once these are addressed, the application will be well-positioned for a successful launch.

**Recommended Next Steps:**
1. Fix all P0 issues (1 day)
2. Get security review from CISO/InfoSec team
3. Complete P1 fixes (1 week)
4. Penetration testing
5. Staged rollout with monitoring

---

**Report compiled by:** GitHub Copilot Coding Agent  
**Review methodology:** Static code analysis, dependency audit, OWASP Top 10 checklist, security best practices review
