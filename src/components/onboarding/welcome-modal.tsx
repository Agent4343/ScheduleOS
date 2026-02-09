"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useOnboarding } from "@/contexts/onboarding-context"
import {
  Calendar,
  Users,
  Users2,
  Wand2,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Add Your Workers",
    description: "Start by adding employees who need shift scheduling",
  },
  {
    icon: Users2,
    title: "Create Crews",
    description: "Group workers into teams with shared rotation patterns",
  },
  {
    icon: Wand2,
    title: "Generate Schedules",
    description: "Use the Setup wizard to create schedules in seconds",
  },
  {
    icon: Calendar,
    title: "Manage & Adjust",
    description: "View, edit, and optimize your workforce schedule",
  },
]

export function WelcomeModal() {
  const { showWelcomeModal, dismissWelcome, startTour } = useOnboarding()

  const handleStartTour = () => {
    dismissWelcome()
    startTour()
  }

  const handleSkip = () => {
    dismissWelcome()
  }

  return (
    <Modal
      isOpen={showWelcomeModal}
      onClose={handleSkip}
      className="max-w-xl"
    >
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to ShiftSync!</h2>
        <p className="text-muted-foreground">
          Your AI-powered workforce scheduling platform. Let&apos;s get you set up in just a few steps.
        </p>
      </div>

      <div className="grid gap-3 mb-6">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 border"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
              <span className="text-sm font-semibold">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <feature.icon className="h-4 w-4 text-primary shrink-0" />
                <h3 className="font-medium">{feature.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSkip}
        >
          Skip for now
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={handleStartTour}
        >
          Take a Quick Tour
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground mt-4">
        You can always restart the tour from Settings
      </p>
    </Modal>
  )
}
