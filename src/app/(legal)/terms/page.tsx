import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Terms of Service | ShiftSync",
  description: "Terms of Service for ShiftSync workforce scheduling platform",
}

export default function TermsOfServicePage() {
  const lastUpdated = "January 28, 2026"

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using ShiftSync (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              ShiftSync is a workforce scheduling platform that enables organizations to manage
              employee schedules, time-off requests, crew assignments, and related workforce
              management activities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To use the Service, you must:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Create an account with accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly notify us of any unauthorized access</li>
              <li>Be at least 16 years of age</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You are responsible for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Organization Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              Organizations using ShiftSync are responsible for ensuring that all users within
              their organization comply with these Terms. Organization administrators have
              additional responsibilities including managing user access and ensuring appropriate
              use of the Service within their organization.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Upload malicious code or content</li>
              <li>Violate the rights of others</li>
              <li>Use the Service to send spam or unsolicited communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data and Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our Privacy Policy. By using the
              Service, you consent to the collection and use of your information as described
              in the Privacy Policy. Organizations are responsible for ensuring they have
              appropriate consent from their employees to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service and its original content, features, and functionality are owned by
              ShiftSync and are protected by international copyright, trademark, and other
              intellectual property laws. You retain ownership of any data you submit to
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to maintain high availability of the Service but do not guarantee
              uninterrupted access. We may modify, suspend, or discontinue any aspect of
              the Service at any time with reasonable notice when possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHIFTSYNC SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
              OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF
              DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless ShiftSync and its officers, directors,
              employees, and agents from any claims, damages, losses, or expenses arising from
              your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately,
              without prior notice, for conduct that we believe violates these Terms or is
              harmful to other users, us, or third parties, or for any other reason at our
              sole discretion. You may also terminate your account at any time through your
              account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of
              any material changes by posting the new Terms on this page and updating the
              &quot;Last updated&quot; date. Your continued use of the Service after such changes
              constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of
              the jurisdiction in which ShiftSync operates, without regard to its conflict
              of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: legal@shiftsync.com
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t">
          <Link
            href="/privacy"
            className="text-primary hover:underline"
          >
            View Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}
