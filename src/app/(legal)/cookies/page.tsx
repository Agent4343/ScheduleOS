import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "ShiftSync Cookie Policy - How we use cookies and similar technologies.",
}

export default function CookiePolicyPage() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1>Cookie Policy</h1>
      <p className="lead">
        Last updated: January 17, 2026
      </p>

      <p>
        This Cookie Policy explains how ShiftSync uses cookies and similar technologies
        when you visit our website or use our platform.
      </p>

      <h2>What Are Cookies?</h2>
      <p>
        Cookies are small text files that are stored on your device (computer, tablet, or
        mobile) when you visit a website. They help websites remember your preferences and
        understand how you interact with the site.
      </p>

      <h2>How We Use Cookies</h2>
      <p>ShiftSync uses cookies for the following purposes:</p>

      <h3>Essential Cookies</h3>
      <p>
        These cookies are necessary for the website to function properly. They enable core
        functionality such as:
      </p>
      <ul>
        <li>User authentication and session management</li>
        <li>Security features and fraud prevention</li>
        <li>Remembering your login status</li>
        <li>Load balancing to ensure service availability</li>
      </ul>
      <p>
        <strong>These cookies cannot be disabled</strong> as they are essential to the
        operation of our service.
      </p>

      <h3>Functional Cookies</h3>
      <p>
        These cookies enable enhanced functionality and personalization:
      </p>
      <ul>
        <li>Remembering your preferences (language, timezone)</li>
        <li>Storing your display settings</li>
        <li>Remembering your last viewed schedule</li>
      </ul>

      <h3>Analytics Cookies</h3>
      <p>
        We may use analytics cookies to understand how visitors interact with our website.
        This helps us improve our service. Analytics cookies collect information such as:
      </p>
      <ul>
        <li>Pages visited and time spent</li>
        <li>Features used most frequently</li>
        <li>Error messages encountered</li>
        <li>Device and browser information</li>
      </ul>
      <p>
        This information is aggregated and anonymized, meaning it cannot be used to
        identify you personally.
      </p>

      <h2>Cookies We Use</h2>
      <table>
        <thead>
          <tr>
            <th>Cookie Name</th>
            <th>Purpose</th>
            <th>Duration</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>next-auth.session-token</td>
            <td>User authentication</td>
            <td>Session / 30 days</td>
            <td>Essential</td>
          </tr>
          <tr>
            <td>next-auth.csrf-token</td>
            <td>Security (CSRF protection)</td>
            <td>Session</td>
            <td>Essential</td>
          </tr>
          <tr>
            <td>next-auth.callback-url</td>
            <td>Redirect after login</td>
            <td>Session</td>
            <td>Essential</td>
          </tr>
          <tr>
            <td>shiftsync_preferences</td>
            <td>User display preferences</td>
            <td>1 year</td>
            <td>Functional</td>
          </tr>
        </tbody>
      </table>

      <h2>Third-Party Cookies</h2>
      <p>
        We may use third-party services that set their own cookies. These include:
      </p>
      <ul>
        <li><strong>Hosting providers:</strong> For performance and security</li>
        <li><strong>Analytics services:</strong> To understand usage patterns</li>
      </ul>
      <p>
        We do not allow third-party advertising cookies on our platform.
      </p>

      <h2>Managing Cookies</h2>
      <p>
        You can control and manage cookies in several ways:
      </p>

      <h3>Browser Settings</h3>
      <p>
        Most browsers allow you to view, manage, and delete cookies through their settings.
        Note that blocking all cookies may affect the functionality of our service.
      </p>
      <ul>
        <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies</li>
        <li><strong>Firefox:</strong> Settings → Privacy &amp; Security → Cookies</li>
        <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
        <li><strong>Edge:</strong> Settings → Privacy, search, and services → Cookies</li>
      </ul>

      <h3>Do Not Track</h3>
      <p>
        Some browsers support &quot;Do Not Track&quot; signals. We respect these signals where technically
        feasible, though our essential cookies will still function.
      </p>

      <h2>Updates to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time to reflect changes in our
        practices or for legal reasons. We will post any changes on this page.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have questions about our use of cookies, please contact us at:
      </p>
      <p>
        <strong>Email:</strong> privacy@shiftsync.app
      </p>
    </article>
  )
}
