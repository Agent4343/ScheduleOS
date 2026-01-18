"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
}

function Avatar({ className, src, alt, fallback, size = "md", ...props }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false)

  const initials = React.useMemo(() => {
    if (fallback) return fallback.slice(0, 2).toUpperCase()
    if (alt) {
      const parts = alt.split(" ").filter(part => part.length > 0)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return alt.trim().slice(0, 2).toUpperCase()
    }
    return "??"
  }, [fallback, alt])

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-muted",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt || "Avatar"}
          className="aspect-square h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 font-medium text-white">
          {initials}
        </span>
      )}
    </div>
  )
}

export { Avatar }
