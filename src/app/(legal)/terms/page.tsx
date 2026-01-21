import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "ShiftSync Terms of Service - The terms and conditions for using our platform.",
}

export default function TermsOfServicePage() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1>Terms of Service</h1>
      <p className="lead">
        Last updated: January 17, 2026
      </p>

      <p>
        Welcome to ShiftSync. These Terms of Service (&quot;Terms&quot;) govern your use of our
        workforce scheduling platform and services. By accessing or using ShiftSync, you agree
        to be bound by these Terms.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or using ShiftSync, you confirm that you have read, understood,
        and agree to these Terms. If you do not agree, please do not use our services.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        ShiftSync provides a workforce scheduling platform designed for organizations with
        rotating shift patterns, including offshore oil and gas operations. Our services include:
      </p>
      <ul>
        <li>Schedule creation and management</li>
        <li>Crew and worker management</li>
        <li>Time-off request processing</li>
        <li>Reporting and analytics</li>
        <li>Notification and communication tools</li>
      </ul>

      <h2>3. Account Registration</h2>
      <p>To use ShiftSync, you must:</p>
      <ul>
        <li>Provide accurate and complete registration information</li>
        <li>Maintain the security of your account credentials</li>
        <li>Promptly notify us of any unauthorized access</li>
        <li>Be at least 18 years old or have parental consent</li>
      </ul>
      <p>
        You are responsible for all activities that occur under your account.
      </p>

      <h2>4. Subscription and Payment</h2>
      <h3>Pricing</h3>
      <p>
        ShiftSync offers various subscription plans. Prices are listed on our website and may
        change with notice. All prices are in USD unless otherwise stated.
      </p>

      <h3>Free Trial</h3>
      <p>
        New users may be eligible for a free trial period. At the end of the trial, you will
        need to subscribe to continue using the service.
      </p>

      <h3>Billing</h3>
      <p>
        Subscriptions are billed in advance on a monthly or annual basis. You authorize us to
        charge your payment method for all fees incurred.
      </p>

      <h3>Cancellation</h3>
      <p>
        You may cancel your subscription at any time. Cancellation takes effect at the end of
        the current billing period. No refunds are provided for partial periods.
      </p>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use ShiftSync for any unlawful purpose</li>
        <li>Attempt to gain unauthorized access to our systems</li>
        <li>Interfere with or disrupt the service</li>
        <li>Upload malicious code or content</li>
        <li>Impersonate others or provide false information</li>
        <li>Resell or redistribute the service without permission</li>
        <li>Use automated systems to access the service (except approved APIs)</li>
      </ul>

      <h2>6. Data and Privacy</h2>
      <p>
        Your use of ShiftSync is also governed by our Privacy Policy. By using the service,
        you consent to the collection and use of your data as described in that policy.
      </p>
      <p>
        You retain ownership of the data you input into ShiftSync. You grant us a license to
        use this data solely to provide and improve our services.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        ShiftSync and its original content, features, and functionality are owned by us and
        are protected by international copyright, trademark, and other intellectual property laws.
      </p>
      <p>
        You may not copy, modify, distribute, or reverse engineer any part of our service
        without our written permission.
      </p>

      <h2>8. Disclaimer of Warranties</h2>
      <p>
        ShiftSync is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
        either express or implied. We do not warrant that the service will be uninterrupted,
        secure, or error-free.
      </p>
      <p>
        We are not responsible for scheduling decisions made using our platform. Users should
        verify schedules and maintain appropriate backup systems.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, ShiftSync shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, including loss of profits,
        data, or business opportunities.
      </p>
      <p>
        Our total liability for any claim arising from these Terms shall not exceed the amount
        you paid us in the twelve (12) months preceding the claim.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless ShiftSync and its officers, directors,
        employees, and agents from any claims, damages, or expenses arising from your use
        of the service or violation of these Terms.
      </p>

      <h2>11. Modifications to Service</h2>
      <p>
        We reserve the right to modify, suspend, or discontinue any part of ShiftSync at any
        time, with or without notice. We shall not be liable for any modification, suspension,
        or discontinuation.
      </p>

      <h2>12. Termination</h2>
      <p>
        We may terminate or suspend your account immediately, without prior notice, if you
        breach these Terms. Upon termination, your right to use the service ceases immediately.
      </p>
      <p>
        You may export your data before termination. We will retain your data for a reasonable
        period to allow data export, after which it may be deleted.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of Canada,
        without regard to its conflict of law provisions. Any disputes shall be resolved in
        the courts of Newfoundland and Labrador.
      </p>

      <h2>14. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of significant changes
        by email or through the service. Your continued use after changes constitutes acceptance
        of the new Terms.
      </p>

      <h2>15. Contact Information</h2>
      <p>
        For questions about these Terms, please contact us at:
      </p>
      <p>
        <strong>Email:</strong> legal@shiftsync.app
      </p>
    </article>
  )
}
