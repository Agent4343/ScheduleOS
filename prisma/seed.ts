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

  // Opt-in demo user seeding (disabled by default for security)
  // To create demo users, set: SEED_DEMO=true SEED_DEMO_PASSWORD=yourpassword npm run db:seed
  // For local development without demo users, use Prisma Studio to create an admin:
  //   npx prisma studio
  //   Or manually: const hash = await bcrypt.hash('yourpassword', 12); await prisma.user.create({...})
  if (process.env.SEED_DEMO === 'true') {
    const demoPassword = process.env.SEED_DEMO_PASSWORD
    
    if (!demoPassword) {
      console.warn('⚠️  SEED_DEMO is enabled but SEED_DEMO_PASSWORD is not set. Skipping demo user creation.')
      console.warn('   Set SEED_DEMO_PASSWORD to create demo users: SEED_DEMO=true SEED_DEMO_PASSWORD=yourpassword npm run db:seed')
    } else {
      // Create demo admin user with provided password
      const passwordHash = await bcrypt.hash(demoPassword, 12)

      const admin = await prisma.user.upsert({
        where: { email: "admin@local" },
        update: {},
        create: {
          email: "admin@local",
          name: "Local Admin",
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          organizationId: organization.id,
        },
      })

      console.log("✓ Created demo admin user:", admin.email)

      // Create minimal demo workers
      const workers = [
        { name: "Demo Worker 1", email: "worker1@local", crew: "Crew A", position: "Operator", positionType: "OPERATOR" as const },
        { name: "Demo Worker 2", email: "worker2@local", crew: "Crew B", position: "Operator", positionType: "OPERATOR" as const },
      ]

      for (const worker of workers) {
        await prisma.user.upsert({
          where: { email: worker.email },
          update: {},
          create: {
            email: worker.email,
            name: worker.name,
            passwordHash,
            role: "WORKER",
            position: worker.position,
            positionType: worker.positionType,
            status: "ACTIVE",
            organizationId: organization.id,
            crewId: crews[worker.crew],
          },
        })
      }

      console.log("✓ Created demo workers")
    }
  } else {
    console.log('ℹ️  Demo user creation is disabled (SEED_DEMO != true)')
    console.log('   To enable: SEED_DEMO=true SEED_DEMO_PASSWORD=yourpassword npm run db:seed')
    console.log('   For manual admin creation, use Prisma Studio: npx prisma studio')
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
