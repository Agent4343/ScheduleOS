import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReplayTourButton } from "@/features/tour/replay-button"

export const metadata: Metadata = { title: "Help · ShiftSync" }

/**
 * The glossary. Every term the app uses that somebody arriving from a
 * spreadsheet would not already know, explained in the language of the
 * platform rather than the language of the database. Anchors are stable
 * (#position-group and so on) because the forms link straight to them.
 */

interface Term {
  id: string
  term: string
  short: string
  body: React.ReactNode
}

const TERMS: Term[] = [
  {
    id: "position-group",
    term: "Position group",
    short: "The block a person sits in on the roster",
    body: (
      <>
        <p>
          The heading a person appears under on your roster: OIM, Production Supervisor, Production Leads, OCR Ops, Ops
          Techs. It does two things — it decides the order people appear in on the schedule, and it says what job they
          are doing when they are simply marked on for a day or a night.
        </p>
        <p>
          An Ops Tech marked <strong>D</strong> is an outside operator that day. An OCR Op marked <strong>D</strong> is
          in the control room. Same letter, different job, because they are in different groups.
        </p>
        <p className="text-muted-foreground">
          Management groups are deliberately left pointing at nothing, which is how they stay out of the operations
          counts — the same effect as your spreadsheet starting its count rows below the management block.
        </p>
      </>
    ),
  },
  {
    id: "coverage-role",
    term: "Coverage role",
    short: "Something each shift has to be staffed with",
    body: (
      <>
        <p>
          A job a shift must have people doing: Outside Ops, Control Room, Production Lead, and so on. Each one carries
          four numbers — a minimum and a target, for days and for nights.
        </p>
        <p>
          The <strong>minimum</strong> is the point below which the shift cannot run: below it, the day goes red. The{" "}
          <strong>target</strong> is what you would like: between the two, it goes amber. At or above target it is
          green. These are the same thresholds your spreadsheet coloured by hand.
        </p>
      </>
    ),
  },
  {
    id: "duty-code",
    term: "Duty code",
    short: "A code that moves someone to a different job for the day",
    body: (
      <>
        <p>
          Most days a person does their usual job, and a plain <strong>D</strong> or <strong>N</strong> says so. A duty
          code says <em>today is different</em>: <strong>OCR-D</strong>, <strong>CCR-N</strong>, <strong>PL-D</strong>,{" "}
          <strong>BCCR-N</strong>.
        </p>
        <p>
          Each code names a job and a shift, so an Ops Tech on <strong>CCR-D</strong> counts toward the control room
          that day and not toward outside ops — and the outside ops count drops by one, correctly, because they are not
          out there.
        </p>
        <p className="text-muted-foreground">
          Codes that are not work at all — <strong>SL</strong>, <strong>TR</strong>, <strong>L</strong> — simply count
          toward nothing.
        </p>
      </>
    ),
  },
  {
    id: "backfill",
    term: "Backfill",
    short: "Acting up into someone else's job",
    body: (
      <p>
        A flag on a duty code meaning the person is covering a role above or across from their own — an operator acting
        as production lead, for instance. They count toward that role exactly like anyone else; the flag only marks them
        on the roster so you can see at a glance that the shift is being held together by someone acting up.
      </p>
    ),
  },
  {
    id: "sign-off",
    term: "Sign-off",
    short: "Training a person is certified on",
    body: (
      <>
        <p>
          Utilities operator, oil operator, gas operator, control room trained. You tick these per person, and a
          coverage role can require them.
        </p>
        <p>
          The important part: <strong>each requirement must be a different person</strong>. If one operator is signed
          off on both oil and gas and nobody else holds either, the shift is short — that person cannot be in two places.
          The app works this out properly rather than just counting certificates, so a crew at full strength can still
          show red if the sign-offs cannot all be filled. When that happens the cell is marked with an
          exclamation mark; click it to see which one has nobody left.
        </p>
      </>
    ),
  },
  {
    id: "roster-order",
    term: "Roster order",
    short: "Where a person sits within their group",
    body: (
      <p>
        A number that fixes the order people appear in on the schedule, within their position group. It exists so the
        screen matches the running order of your paper or spreadsheet roster — the person who has always been the first
        line stays the first line. Leave it blank and people fall back to alphabetical order.
      </p>
    ),
  },
  {
    id: "rotation-anchor",
    term: "Rotation anchor",
    short: "The known-good date a rotation is measured from",
    body: (
      <>
        <p>
          A rotation is a repeating pattern — two weeks on, two weeks off, days then nights. To know which part of the
          pattern a crew is on for any given date, the app needs one date where it knows the answer for certain. That
          date is the anchor.
        </p>
        <p>
          Everything else is counted forwards or backwards from it. This is why a rotation can be corrected without
          rewriting history: move the anchor and every future date follows, while the past stays as it was recorded.
        </p>
      </>
    ),
  },
  {
    id: "override",
    term: "Override",
    short: "A day changed by hand",
    body: (
      <p>
        Any day you set yourself, rather than one the rotation generated. Overrides are marked so that regenerating a
        crew&apos;s rotation does not quietly undo the changes you made on purpose. Re-importing a spreadsheet is the one
        thing that does replace them, because there the spreadsheet is the record.
      </p>
    ),
  },
]

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Help</h1>
          <p className="text-muted-foreground">What the words on the screen mean.</p>
        </div>
        <ReplayTourButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Starting from a spreadsheet</CardTitle>
          <CardDescription>The short version, if you already keep a roster in Excel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <Link href="/settings#coverage" className="underline">Settings → Coverage</Link>, then{" "}
              <strong>Offshore ops template</strong>. This creates the usual jobs, groups and codes in one go, so the
              import has something to map your codes onto.
            </li>
            <li>
              <Link href="/settings#import" className="underline">Settings → Import from a spreadsheet</Link>. Upload your
              workbook — or download the blank template there, which comes set up with your groups and codes and checks
              them as you type. Either way it shows you what it found before writing anything.
            </li>
            <li>
              <Link href="/workers" className="underline">Workers</Link>: tick each person&apos;s{" "}
              <Link href="#sign-off" className="underline">sign-offs</Link>. The import can only pick up the ones your
              sheet records.
            </li>
            <li>
              <Link href="/coverage" className="underline">Coverage</Link>: check a couple of weeks you already know the
              answer for. It should agree with your sheet.
            </li>
          </ol>
          <p className="text-muted-foreground">
            You do not have to start this way. Setting up crews and rotation patterns by hand works too — see{" "}
            <Link href="/getting-started" className="underline">Getting Started</Link>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Words the app uses</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {TERMS.map((t) => (
            <section key={t.id} id={t.id} className="scroll-mt-20 py-4 first:pt-0 last:pb-0">
              <h2 className="font-semibold">{t.term}</h2>
              <p className="text-sm text-muted-foreground">{t.short}</p>
              <div className="mt-2 space-y-2 text-sm">{t.body}</div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How a day is judged</CardTitle>
          <CardDescription>What the colours on the Coverage board actually mean</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>For each job, on each shift, the app works through this in order:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Who is working — anyone marked on for that day or night.</li>
            <li>
              What each of them is doing. A <Link href="#duty-code" className="underline">duty code</Link> decides it
              outright; otherwise it is whatever their{" "}
              <Link href="#position-group" className="underline">position group</Link> normally does.
            </li>
            <li>Count them against the minimum and the target for that job.</li>
            <li>
              Then check the <Link href="#sign-off" className="underline">sign-offs</Link>, giving each one a different
              person.
            </li>
          </ol>
          <p>
            Red means either too few people, or a sign-off that cannot be filled. Amber means enough to run but below
            what you asked for. Green means fine. A day takes the colour of its worst line.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
