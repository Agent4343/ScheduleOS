import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create demo organization
  const organization = await prisma.organization.upsert({
    where: { slug: "demo-company" },
    update: {},
    create: {
      name: "Demo Company",
      slug: "demo-company",
      settings: {
        timezone: "America/St_Johns",
        weekStartsOn: 0,
        minStaffingAlertEnabled: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        minStaffOperators: 2,
        minStaffOnshoreControlRoom: 1,
      },
    },
  })

  console.log("Created organization:", organization.name)

  // Create rotation patterns
  const patterns = [
    {
      name: "3 on / 3 off",
      description: "Standard 3 days on, 3 days off rotation",
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      isDefault: true,
    },
    {
      name: "3 on / 3 off (with nights)",
      description: "3 days on with night shifts, 3 days off",
      daysOn: 3,
      daysOff: 3,
      includesNights: true,
      nightsAtStart: true,
      nightDays: 2,
    },
    {
      name: "14 on / 14 off",
      description: "Offshore rotation: 14 days on, 14 days off",
      daysOn: 14,
      daysOff: 14,
      includesNights: false,
    },
  ]

  for (const pattern of patterns) {
    await prisma.rotationPattern.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: pattern.name,
        },
      },
      update: {},
      create: {
        ...pattern,
        organizationId: organization.id,
      },
    })
  }

  console.log("Created rotation patterns")

  // Get default pattern
  const defaultPattern = await prisma.rotationPattern.findFirst({
    where: { organizationId: organization.id, isDefault: true },
  })

  // Create crews
  const crewData = [
    { name: "Crew A", color: "#3B82F6", currentPhase: 0 },
    { name: "Crew B", color: "#10B981", currentPhase: 3 },
    { name: "Crew C", color: "#F59E0B", currentPhase: 1 },
    { name: "Crew D", color: "#8B5CF6", currentPhase: 4 },
  ]

  const crews: Record<string, string> = {}

  for (const crew of crewData) {
    const created = await prisma.crew.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: crew.name,
        },
      },
      update: {},
      create: {
        ...crew,
        organizationId: organization.id,
        rotationPatternId: defaultPattern?.id,
      },
    })
    crews[crew.name] = created.id
  }

  console.log("Created crews")

  // Create staffing rules
  await prisma.staffingRule.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Day Shift Minimum",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Day Shift Minimum",
      shiftType: "DAY",
      minWorkers: 2,
      maxVacation: 1,
    },
  })

  await prisma.staffingRule.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Night Shift Minimum",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Night Shift Minimum",
      shiftType: "NIGHT",
      minWorkers: 1,
      maxVacation: 1,
    },
  })

  console.log("Created staffing rules")

  // Optional: Create demo users only if SEED_DEMO environment variable is set to 'true'
  // This is for development purposes only and should not be used in production
  if (process.env.SEED_DEMO === "true") {
    console.log("SEED_DEMO is enabled, creating demo users...")
    
    // Require explicit credentials when creating demo users
    const demoAdminEmail = process.env.SEED_ADMIN_EMAIL
    const demoAdminPassword = process.env.SEED_ADMIN_PASSWORD
    
    if (!demoAdminEmail || !demoAdminPassword) {
      console.error("ERROR: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set when SEED_DEMO=true")
      console.error("Example: SEED_DEMO=true SEED_ADMIN_EMAIL=admin@local.dev SEED_ADMIN_PASSWORD=yourpassword npm run db:seed")
      process.exit(1)
    }
    
    const passwordHash = await bcrypt.hash(demoAdminPassword, 12)

    const admin = await prisma.user.upsert({
      where: { email: demoAdminEmail },
      update: {},
      create: {
        email: demoAdminEmail,
        name: "Admin User",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: organization.id,
      },
    })

    console.log("Created demo admin user:", admin.email)

    // Create demo workers (optional, only if SEED_DEMO is true)
    if (process.env.SEED_DEMO_WORKERS === "true") {
      const demoWorkerPassword = process.env.SEED_WORKER_PASSWORD || demoAdminPassword
      const workerPasswordHash = await bcrypt.hash(demoWorkerPassword, 12)
      
      const workers = [
        { name: "John Smith", email: "john@example.com", crew: "Crew A", position: "Operator", positionType: "OPERATOR" as const },
        { name: "Jane Doe", email: "jane@example.com", crew: "Crew A", position: "Control Room", positionType: "ONSHORE_CONTROL_ROOM" as const },
        { name: "Mike Johnson", email: "mike@example.com", crew: "Crew B", position: "Operator", positionType: "OPERATOR" as const },
        { name: "Sarah Williams", email: "sarah@example.com", crew: "Crew B", position: "Control Room", positionType: "ONSHORE_CONTROL_ROOM" as const },
        { name: "Tom Brown", email: "tom@example.com", crew: "Crew C", position: "Operator", positionType: "OPERATOR" as const },
        { name: "Emily Davis", email: "emily@example.com", crew: "Crew C", position: "Control Room", positionType: "ONSHORE_CONTROL_ROOM" as const },
        { name: "Chris Wilson", email: "chris@example.com", crew: "Crew D", position: "Operator", positionType: "OPERATOR" as const },
        { name: "Lisa Anderson", email: "lisa@example.com", crew: "Crew D", position: "Control Room", positionType: "ONSHORE_CONTROL_ROOM" as const },
      ]

      for (const worker of workers) {
        await prisma.user.upsert({
          where: { email: worker.email },
          update: {},
          create: {
            email: worker.email,
            name: worker.name,
            passwordHash: workerPasswordHash,
            role: "WORKER",
            position: worker.position,
            positionType: worker.positionType,
            status: "ACTIVE",
            organizationId: organization.id,
            crewId: crews[worker.crew],
          },
        })
      }

      console.log("Created demo workers")
    }
  } else {
    console.log("Skipping demo user creation (set SEED_DEMO=true to enable)")
    console.log("To create an admin user, you can:")
    console.log("  1. Use Prisma Studio: npx prisma studio")
    console.log("  2. Set SEED_DEMO=true SEED_ADMIN_EMAIL=your@email.com SEED_ADMIN_PASSWORD=yourpassword and run the seed again")
    console.log("  3. Create a user directly via database tools or API")
  }

  console.log("Seeding completed!")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
