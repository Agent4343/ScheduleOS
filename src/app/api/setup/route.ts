import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  // Simple security: require a setup key
  const setupKey = request.nextUrl.searchParams.get("key")

  if (setupKey !== process.env.SETUP_KEY && setupKey !== "initial-setup-2026") {
    return NextResponse.json(
      { error: "Invalid setup key" },
      { status: 401 }
    )
  }

  try {
    // Run prisma db push
    const { stdout, stderr } = await execAsync("npx prisma db push --skip-generate")

    return NextResponse.json({
      success: true,
      message: "Database setup complete",
      output: stdout,
      warnings: stderr || undefined,
    })
  } catch (error) {
    console.error("Setup error:", error)
    return NextResponse.json(
      {
        error: "Setup failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
