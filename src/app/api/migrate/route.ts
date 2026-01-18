import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Add the customShiftCode column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Schedule"
      ADD COLUMN IF NOT EXISTS "customShiftCode" TEXT;
    `)

    // Add CUSTOM to ShiftType enum if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TYPE "ShiftType" ADD VALUE IF NOT EXISTS 'CUSTOM';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)

    // Create CustomShiftType table if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CustomShiftType" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "color" TEXT NOT NULL DEFAULT '#6b7280',
        "textColor" TEXT NOT NULL DEFAULT '#ffffff',
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "organizationId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CustomShiftType_pkey" PRIMARY KEY ("id")
      );
    `)

    // Create unique index if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CustomShiftType_organizationId_code_key"
      ON "CustomShiftType"("organizationId", "code");
    `)

    // Add foreign key if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'CustomShiftType_organizationId_fkey'
        ) THEN
          ALTER TABLE "CustomShiftType"
          ADD CONSTRAINT "CustomShiftType_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `)

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully! You can now use the schedule features."
    })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Migration failed"
    }, { status: 500 })
  }
}
