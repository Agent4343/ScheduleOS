# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ShiftSync / ScheduleOS, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email**: Send details to **security@shiftsync.app**
2. **Subject line**: `[SECURITY] Brief description of the vulnerability`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge your report within 48 hours.
- **Assessment**: We will assess the vulnerability within 5 business days.
- **Resolution**: Critical vulnerabilities will be patched within 7 days. Other issues will be addressed in the next release cycle.
- **Disclosure**: We will coordinate disclosure timing with you.

### Scope

The following are in scope:
- Authentication and authorization bypasses
- SQL injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities
- Data exposure or leakage
- Privilege escalation
- Remote code execution

The following are out of scope:
- Denial of service attacks
- Social engineering
- Issues in third-party dependencies (report to the upstream project)
- Issues requiring physical access

### Recognition

We appreciate security researchers who help keep ShiftSync safe. With your permission, we will acknowledge your contribution in our release notes.
