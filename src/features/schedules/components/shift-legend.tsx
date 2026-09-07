"use client"

import type { ShiftKey, ShiftStyle } from "../shift-styles"

export function ShiftLegend({ styles }: { styles: Record<ShiftKey, ShiftStyle> }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Shift legend">
      {Object.entries(styles).map(([key, style]) => (
        <li
          key={key}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{ backgroundColor: style.bg, color: style.text }}
        >
          <span className="font-bold">{style.label}</span>
          <span>= {style.name}</span>
        </li>
      ))}
    </ul>
  )
}
