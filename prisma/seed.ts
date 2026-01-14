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

  // Create demo admin user
  const passwordHash = await bcrypt.hash("demo1234", 12)

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: organization.id,
    },
  })

  console.log("Created admin user:", admin.email)

  // Create demo workers
  const workers = [
    { name: "John Smith", email: "john@demo.com", crew: "Crew A", position: "Operator" },
    { name: "Jane Doe", email: "jane@demo.com", crew: "Crew A", position: "Technician" },
    { name: "Mike Johnson", email: "mike@demo.com", crew: "Crew B", position: "Operator" },
    { name: "Sarah Williams", email: "sarah@demo.com", crew: "Crew B", position: "Supervisor" },
    { name: "Tom Brown", email: "tom@demo.com", crew: "Crew C", position: "Operator" },
    { name: "Emily Davis", email: "emily@demo.com", crew: "Crew C", position: "Technician" },
    { name: "Chris Wilson", email: "chris@demo.com", crew: "Crew D", position: "Operator" },
    { name: "Lisa Anderson", email: "lisa@demo.com", crew: "Crew D", position: "Technician" },
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
        status: "ACTIVE",
        organizationId: organization.id,
        crewId: crews[worker.crew],
      },
    })
  }

  console.log("Created demo workers")

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
