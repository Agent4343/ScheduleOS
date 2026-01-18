import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Add alternatesShifts column to RotationPattern table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "RotationPattern"
      ADD COLUMN IF NOT EXISTS "alternatesShifts" BOOLEAN NOT NULL DEFAULT false;
    `)

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully! alternatesShifts column added to RotationPattern.",
    })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
