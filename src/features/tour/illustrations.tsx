"use client"

/**
 * Diagrams for the welcome walkthrough.
 *
 * Deliberately diagrams rather than mock screenshots: a fake screenshot goes
 * stale the moment a button moves and quietly teaches people the wrong thing.
 * Each one shows the mechanism the step is describing, and nothing else.
 *
 * `currentColor` throughout so they work in either theme.
 */

const OK = "#16a34a"
const AMBER = "#d97706"
const RED = "#dc2626"
const MUTED = "#94a3b8"

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 320 150" className="w-full h-auto" role="img" aria-label={label}>
      {children}
    </svg>
  )
}

/** A spreadsheet turning into the app's own grid. */
export function ImportIllustration() {
  return (
    <Frame label="A roster spreadsheet being loaded into the app">
      <g opacity="0.9">
        <rect x="8" y="26" width="120" height="98" rx="4" fill="none" stroke={MUTED} strokeWidth="1.5" />
        <text x="68" y="20" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">your spreadsheet</text>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <line key={r} x1="8" y1={40 + r * 14} x2="128" y2={40 + r * 14} stroke={MUTED} strokeWidth="0.5" />
        ))}
        {[0, 1, 2, 3, 4].map((c) => (
          <line key={c} x1={28 + c * 20} y1="26" x2={28 + c * 20} y2="124" stroke={MUTED} strokeWidth="0.5" />
        ))}
        {["D", "D", "N", "D"].map((t, i) => (
          <text key={i} x={38 + i * 20} y={51 + i * 14} textAnchor="middle" fontSize="8" fill="currentColor">{t}</text>
        ))}
      </g>

      <g>
        <path d="M138 75 H182" stroke="currentColor" strokeWidth="2" markerEnd="url(#tour-arrow)" opacity="0.8">
          <animate attributeName="opacity" values="0.25;1;0.25" dur="2.4s" repeatCount="indefinite" />
        </path>
        <defs>
          <marker id="tour-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
          </marker>
        </defs>
      </g>

      <g>
        <rect x="192" y="26" width="120" height="98" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="252" y="20" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">ShiftSync</text>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <line key={r} x1="192" y1={40 + r * 14} x2="312" y2={40 + r * 14} stroke={MUTED} strokeWidth="0.5" />
        ))}
        {[0, 1, 2, 3, 4, 5].map((r) =>
          [0, 1, 2, 3, 4, 5].map((c) => (
            <rect
              key={`${r}-${c}`}
              x={194 + c * 19.5}
              y={28 + r * 14}
              width="17"
              height="10"
              rx="1.5"
              fill={(r + c) % 3 === 0 ? OK : (r + c) % 3 === 1 ? "#3b82f6" : MUTED}
              opacity="0"
            >
              <animate
                attributeName="opacity"
                values="0;0.85;0.85"
                dur="2.4s"
                begin={`${(r * 6 + c) * 0.04}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))
        )}
      </g>
    </Frame>
  )
}

/** A coverage line: how many are on, against the minimum. */
export function CoverageIllustration() {
  // These mirror the real rule: green at or above target, amber between
  // minimum and target, red below minimum. Getting this wrong in the picture
  // would teach the opposite of what the board does.
  const rows = [
    { name: "Outside Ops", have: 4, min: 3, target: 4, colour: OK, label: "covered" },
    { name: "Control Room", have: 2, min: 2, target: 2, colour: OK, label: "covered" },
    { name: "Outside Ops", have: 3, min: 3, target: 4, colour: AMBER, label: "below target" },
    { name: "Outside Ops", have: 2, min: 3, target: 4, colour: RED, label: "short" },
  ]
  return (
    <Frame label="Coverage lines showing how many people are on against the minimum">
      {rows.map((r, i) => (
        <g key={i} transform={`translate(0 ${8 + i * 34})`}>
          <text x="8" y="14" fontSize="9" fill="currentColor" opacity="0.85">{r.name}</text>
          {Array.from({ length: Math.max(r.have, r.min, r.target) }).map((_, p) => (
            <circle
              key={p}
              cx={120 + p * 18}
              cy="10"
              r="6"
              // r is animated from 0 on entry; the attribute keeps a static
              // render (or a reduced-motion browser) showing the right thing
              fill={p < r.have ? r.colour : "none"}
              stroke={p < r.have ? r.colour : MUTED}
              strokeWidth="1.5"
              strokeDasharray={p < r.have ? undefined : "2 2"}
            >
              {/* Fills in once and stays. A looping pulse reads as a glitch,
                  not as emphasis. */}
              {p < r.have && (
                <animate
                  attributeName="r"
                  values="0;6"
                  dur="0.35s"
                  begin={`${i * 0.12 + p * 0.07}s`}
                  fill="freeze"
                />
              )}
            </circle>
          ))}
          <text x="228" y="14" fontSize="9" fill={r.colour} fontWeight="600">
            {r.have} / {r.min}
          </text>
          <text x="256" y="14" fontSize="7.5" fill={r.colour} opacity="0.9">
            {r.label}
          </text>
        </g>
      ))}
    </Frame>
  )
}

/**
 * The one-person-one-job rule: the same crew passes a naive count and fails a
 * real assignment, because one operator holds two of the sign-offs.
 */
export function SignOffIllustration() {
  const jobs = ["Utilities", "Oil", "Gas"]
  return (
    <Frame label="Three jobs needing three different people, where one operator holds two sign-offs">
      <text x="46" y="14" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.7">on shift</text>
      <text x="250" y="14" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.7">jobs to fill</text>

      {["A", "B", "C"].map((p, i) => (
        <g key={p} transform={`translate(20 ${30 + i * 36})`}>
          <circle cx="26" cy="10" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
          <text x="26" y="14" textAnchor="middle" fontSize="10" fill="currentColor">{p}</text>
        </g>
      ))}

      {jobs.map((j, i) => (
        <g key={j} transform={`translate(210 ${30 + i * 36})`}>
          <rect x="0" y="0" width="92" height="20" rx="4" fill="none" stroke={i === 2 ? RED : OK} strokeWidth="1.5" />
          <text x="46" y="14" textAnchor="middle" fontSize="9" fill={i === 2 ? RED : "currentColor"}>{j}</text>
        </g>
      ))}

      {/* A holds utilities and oil, B holds oil, C holds neither — so gas has
          nobody. The matching moves A to utilities and gives oil to B. */}
      <path d="M57 40 H210" stroke={OK} strokeWidth="2" fill="none">
        <animate attributeName="stroke-dasharray" values="0 200;200 0" dur="2.6s" repeatCount="indefinite" />
      </path>
      <path d="M57 76 H210" stroke={OK} strokeWidth="2" fill="none">
        <animate attributeName="stroke-dasharray" values="0 200;200 0" dur="2.6s" begin="0.3s" repeatCount="indefinite" />
      </path>
      <path d="M57 112 H206" stroke={RED} strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.6" />
      <text x="132" y="128" textAnchor="middle" fontSize="8" fill={RED}>nobody left signed off</text>
    </Frame>
  )
}

/** Everyone gets in by link, not by a password read out to them. */
export function InviteIllustration() {
  return (
    <Frame label="An invitation link letting someone set their own password">
      <g>
        <rect x="14" y="46" width="86" height="52" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="57" y="70" textAnchor="middle" fontSize="9" fill="currentColor">you</text>
        <text x="57" y="84" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">send a link</text>
      </g>

      <path d="M104 72 H196" stroke="currentColor" strokeWidth="2" markerEnd="url(#tour-arrow2)" />
      <defs>
        <marker id="tour-arrow2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
        </marker>
      </defs>
      <circle cx="120" cy="72" r="4" fill={OK}>
        <animate attributeName="cx" values="110;190" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" dur="2.2s" repeatCount="indefinite" />
      </circle>

      <g>
        <rect x="200" y="46" width="106" height="52" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="253" y="70" textAnchor="middle" fontSize="9" fill="currentColor">they choose</text>
        <text x="253" y="84" textAnchor="middle" fontSize="9" fill="currentColor">their own password</text>
      </g>

      <text x="160" y="126" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">
        you never handle it
      </text>
    </Frame>
  )
}

/** The year grid, and the full-screen view of it. */
export function ScheduleIllustration() {
  return (
    <Frame label="The year schedule expanding to fill the screen">
      <rect x="70" y="34" width="180" height="80" rx="4" fill="none" stroke={MUTED} strokeWidth="1.5" opacity="0.5" />
      <rect x="20" y="20" width="280" height="110" rx="6" fill="none" stroke="currentColor" strokeWidth="2">
        <animate attributeName="x" values="70;20;20" dur="3s" repeatCount="indefinite" />
        <animate attributeName="y" values="34;20;20" dur="3s" repeatCount="indefinite" />
        <animate attributeName="width" values="180;280;280" dur="3s" repeatCount="indefinite" />
        <animate attributeName="height" values="80;110;110" dur="3s" repeatCount="indefinite" />
      </rect>
      {[0, 1, 2, 3, 4].map((r) => (
        <g key={r}>
          <text x="30" y={44 + r * 18} fontSize="7" fill="currentColor" opacity="0.75">worker {r + 1}</text>
          {Array.from({ length: 14 }).map((_, c) => (
            <rect
              key={c}
              x={82 + c * 15}
              y={36 + r * 18}
              width="12"
              height="10"
              rx="1.5"
              fill={(r + c) % 4 === 0 ? "#3b82f6" : (r + c) % 4 === 1 ? OK : MUTED}
              opacity="0.85"
            />
          ))}
        </g>
      ))}
    </Frame>
  )
}
