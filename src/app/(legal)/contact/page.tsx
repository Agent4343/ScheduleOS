import { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MessageSquare } from "lucide-react"

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the ShiftSync team for sales inquiries, support, or general questions.",
}

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
        <p className="text-muted-foreground">
          Have questions about ShiftSync? We&apos;re here to help. Reach out to us through
          any of the channels below.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Mail className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Sales Inquiries</CardTitle>
            <CardDescription>
              Interested in ShiftSync for your organization? Let&apos;s discuss your needs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="mailto:sales@shiftsync.app"
              className="text-primary hover:underline font-medium"
            >
              sales@shiftsync.app
            </a>
            <p className="text-sm text-muted-foreground mt-2">
              For enterprise pricing, custom features, and volume licensing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <MessageSquare className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Support</CardTitle>
            <CardDescription>
              Need help with your account or have technical questions?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="mailto:support@shiftsync.app"
              className="text-primary hover:underline font-medium"
            >
              support@shiftsync.app
            </a>
            <p className="text-sm text-muted-foreground mt-2">
              Our support team typically responds within 24 hours.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>
            For media inquiries, partnerships, or other questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium">Email</p>
            <a
              href="mailto:hello@shiftsync.app"
              className="text-primary hover:underline"
            >
              hello@shiftsync.app
            </a>
          </div>
          <div>
            <p className="font-medium">Location</p>
            <p className="text-muted-foreground">
              St. John&apos;s, Newfoundland and Labrador, Canada
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted/50 rounded-lg p-6">
        <h2 className="font-semibold mb-2">Response Times</h2>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li><strong>Sales:</strong> Within 1 business day</li>
          <li><strong>Support (Pro/Enterprise):</strong> Within 4 hours</li>
          <li><strong>Support (Starter):</strong> Within 24 hours</li>
          <li><strong>General:</strong> Within 2-3 business days</li>
        </ul>
      </div>
    </div>
  )
}
