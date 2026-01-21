import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "ShiftSync Privacy Policy - How we collect, use, and protect your data.",
}

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p className="lead">
        Last updated: January 17, 2026
      </p>

      <p>
        ShiftSync (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
        This Privacy Policy explains how we collect, use, disclose, and safeguard your information
        when you use our workforce scheduling platform.
      </p>

      <h2>Information We Collect</h2>

      <h3>Personal Information</h3>
      <p>We may collect personal information that you voluntarily provide when using ShiftSync, including:</p>
      <ul>
        <li>Name and contact information (email address, phone number)</li>
        <li>Account credentials (username, password)</li>
        <li>Employment information (job title, department, crew assignment)</li>
        <li>Schedule and availability data</li>
        <li>Time-off requests and approvals</li>
      </ul>

      <h3>Automatically Collected Information</h3>
      <p>When you access ShiftSync, we may automatically collect:</p>
      <ul>
        <li>Device information (browser type, operating system)</li>
        <li>IP address and location data</li>
        <li>Usage data (pages visited, features used, time spent)</li>
        <li>Cookies and similar tracking technologies</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <p>We use the collected information to:</p>
      <ul>
        <li>Provide and maintain our scheduling services</li>
        <li>Process and manage your account</li>
        <li>Send notifications about schedule changes and updates</li>
        <li>Respond to your inquiries and support requests</li>
        <li>Improve our services and develop new features</li>
        <li>Ensure compliance with legal obligations</li>
      </ul>

      <h2>Data Sharing and Disclosure</h2>
      <p>We may share your information with:</p>
      <ul>
        <li><strong>Your Organization:</strong> Administrators and supervisors within your organization can access scheduling data</li>
        <li><strong>Service Providers:</strong> Third-party vendors who help us operate our platform (hosting, analytics)</li>
        <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
      </ul>
      <p>We do not sell your personal information to third parties.</p>

      <h2>Data Security</h2>
      <p>
        We implement appropriate technical and organizational measures to protect your personal
        information against unauthorized access, alteration, disclosure, or destruction. This includes:
      </p>
      <ul>
        <li>Encryption of data in transit and at rest</li>
        <li>Regular security assessments</li>
        <li>Access controls and authentication</li>
        <li>Employee training on data protection</li>
      </ul>

      <h2>Data Retention</h2>
      <p>
        We retain your personal information for as long as necessary to provide our services and
        fulfill the purposes outlined in this policy. When data is no longer needed, we securely
        delete or anonymize it.
      </p>

      <h2>Your Rights</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access your personal information</li>
        <li>Correct inaccurate data</li>
        <li>Delete your personal information</li>
        <li>Object to or restrict processing</li>
        <li>Data portability</li>
        <li>Withdraw consent</li>
      </ul>

      <h2>Canadian Privacy Laws (PIPEDA)</h2>
      <p>
        For users in Canada, we comply with the Personal Information Protection and Electronic
        Documents Act (PIPEDA). You have the right to access your personal information and
        challenge its accuracy. Contact us to make a request.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any changes
        by posting the new policy on this page and updating the &quot;Last updated&quot; date.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy or our data practices, please contact us at:
      </p>
      <p>
        <strong>Email:</strong> privacy@shiftsync.app
      </p>
    </article>
  )
}
