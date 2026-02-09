"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { useOnboarding } from "@/contexts/onboarding-context"
import {
  X,
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  Wand2,
  Calendar,
  Users,
  Users2,
  CalendarOff,
  BarChart3,
  Bot,
  Settings,
} from "lucide-react"

interface TourStep {
  id: string
  target: string // CSS selector or sidebar item name
  title: string
  content: string
  icon: React.ElementType
  position: "right" | "bottom" | "left" | "top"
  highlightNav?: string // Navigation item to highlight
}

const tourSteps: TourStep[] = [
  {
    id: "dashboard",
    target: '[data-tour="dashboard"]',
    title: "Dashboard",
    content: "Your home base! See staffing alerts, key stats, and recent activity at a glance.",
    icon: LayoutDashboard,
    position: "right",
    highlightNav: "Dashboard",
  },
  {
    id: "setup",
    target: '[data-tour="setup"]',
    title: "Quick Setup",
    content: "The fastest way to create schedules. Select workers, choose a rotation pattern, and generate schedules in 3 easy steps.",
    icon: Wand2,
    position: "right",
    highlightNav: "Setup",
  },
  {
    id: "schedule",
    target: '[data-tour="schedule"]',
    title: "Schedule View",
    content: "View your full-year calendar. Click any cell to edit shifts, and see staffing coverage at a glance.",
    icon: Calendar,
    position: "right",
    highlightNav: "Schedule",
  },
  {
    id: "workers",
    target: '[data-tour="workers"]',
    title: "Workers",
    content: "Manage your workforce here. Add employees, set their positions, and track certifications.",
    icon: Users,
    position: "right",
    highlightNav: "Workers",
  },
  {
    id: "crews",
    target: '[data-tour="crews"]',
    title: "Crews",
    content: "Group workers into teams. Each crew can have its own rotation pattern and color coding.",
    icon: Users2,
    position: "right",
    highlightNav: "Crews",
  },
  {
    id: "time-off",
    target: '[data-tour="time-off"]',
    title: "Time Off",
    content: "Review and approve time-off requests. See who's on leave and plan coverage.",
    icon: CalendarOff,
    position: "right",
    highlightNav: "Time Off",
  },
  {
    id: "reports",
    target: '[data-tour="reports"]',
    title: "Reports",
    content: "Analyze scheduling patterns, overtime, and coverage metrics with detailed reports.",
    icon: BarChart3,
    position: "right",
    highlightNav: "Reports",
  },
  {
    id: "assistant",
    target: '[data-tour="assistant"]',
    title: "AI Assistant",
    content: "Ask questions in natural language! 'Who's working next Tuesday?' or 'Show me overtime this month'.",
    icon: Bot,
    position: "right",
    highlightNav: "AI Assistant",
  },
  {
    id: "settings",
    target: '[data-tour="settings"]',
    title: "Settings",
    content: "Configure rotation patterns, staffing rules, holidays, and organization preferences.",
    icon: Settings,
    position: "right",
    highlightNav: "Settings",
  },
]

interface TooltipPosition {
  top: number
  left: number
  arrowPosition: "left" | "right" | "top" | "bottom"
}

export function GuidedTour() {
  const { showTour, completeTour } = useOnboarding()
  const [currentStep, setCurrentStep] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const calculatePosition = useCallback(() => {
    if (!showTour) return

    const step = tourSteps[currentStep]

    // Find the navigation item by its data attribute or text
    let targetElement: Element | null = null

    // Try to find by data-tour attribute first
    targetElement = document.querySelector(step.target)

    // If not found, try to find by nav item text in sidebar
    if (!targetElement && step.highlightNav) {
      const navLinks = document.querySelectorAll("aside nav a")
      navLinks.forEach((link) => {
        if (link.textContent?.trim() === step.highlightNav) {
          targetElement = link
        }
      })
    }

    if (!targetElement) {
      // Default to sidebar area if element not found
      setTooltipPosition({
        top: 200 + currentStep * 50,
        left: 280,
        arrowPosition: "left",
      })
      return
    }

    const rect = targetElement.getBoundingClientRect()
    const tooltipWidth = 320
    const tooltipHeight = 200
    const padding = 16

    let top = rect.top + rect.height / 2 - tooltipHeight / 2
    let left = rect.right + padding
    let arrowPosition: "left" | "right" | "top" | "bottom" = "left"

    // Adjust if tooltip would go off screen
    if (left + tooltipWidth > window.innerWidth) {
      left = rect.left - tooltipWidth - padding
      arrowPosition = "right"
    }

    if (top < padding) {
      top = padding
    }

    if (top + tooltipHeight > window.innerHeight - padding) {
      top = window.innerHeight - tooltipHeight - padding
    }

    setTooltipPosition({ top, left, arrowPosition })

    // Add highlight to the target element
    targetElement.classList.add("tour-highlight")

    return () => {
      targetElement?.classList.remove("tour-highlight")
    }
  }, [showTour, currentStep])

  useEffect(() => {
    // Remove highlight from all elements
    document.querySelectorAll(".tour-highlight").forEach((el) => {
      el.classList.remove("tour-highlight")
    })

    if (showTour) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(calculatePosition, 100)
      return () => clearTimeout(timer)
    }
  }, [showTour, currentStep, calculatePosition])

  useEffect(() => {
    const handleResize = () => {
      if (showTour) {
        calculatePosition()
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [showTour, calculatePosition])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleComplete = () => {
    // Remove all highlights
    document.querySelectorAll(".tour-highlight").forEach((el) => {
      el.classList.remove("tour-highlight")
    })
    setCurrentStep(0)
    completeTour()
  }

  const handleSkip = () => {
    handleComplete()
  }

  if (!showTour || !mounted || !tooltipPosition) {
    return null
  }

  const step = tourSteps[currentStep]
  const StepIcon = step.icon

  const tooltip = (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[100]"
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[101] w-80 bg-background rounded-lg shadow-xl border animate-in fade-in-0 zoom-in-95"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-background border transform rotate-45 ${
            tooltipPosition.arrowPosition === "left"
              ? "-left-1.5 top-1/2 -translate-y-1/2 border-l border-b"
              : tooltipPosition.arrowPosition === "right"
                ? "-right-1.5 top-1/2 -translate-y-1/2 border-r border-t"
                : tooltipPosition.arrowPosition === "top"
                  ? "-top-1.5 left-1/2 -translate-x-1/2 border-l border-t"
                  : "-bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b"
          }`}
        />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <StepIcon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">{step.title}</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2 -mt-1"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <p className="text-sm text-muted-foreground mb-4">
            {step.content}
          </p>

          {/* Progress */}
          <div className="flex items-center gap-1 mb-4">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip tour
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
                {currentStep + 1} / {tourSteps.length}
              </span>
              <Button
                size="sm"
                onClick={handleNext}
              >
                {currentStep === tourSteps.length - 1 ? (
                  "Finish"
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tour highlight styles */}
      <style jsx global>{`
        .tour-highlight {
          position: relative;
          z-index: 101 !important;
          background: var(--background) !important;
          box-shadow: 0 0 0 4px rgba(var(--primary-rgb, 59, 130, 246), 0.5) !important;
          border-radius: 8px !important;
        }
      `}</style>
    </>
  )

  return createPortal(tooltip, document.body)
}
