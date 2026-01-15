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
      name: "3 days on / 3 days off",
      description: "3 days on, 3 days off rotation",
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      isDefault: false,
    },
    {
      name: "3 weeks on / 3 weeks off",
      description: "21 days on, 21 days off - alternates days/nights each rotation",
      daysOn: 21,
      daysOff: 21,
      includesNights: true,
      nightsAtStart: true,
      nightDays: 21,
      isDefault: true,
    },
    {
      name: "2 weeks on / 2 weeks off",
      description: "14 days on, 14 days off rotation",
      daysOn: 14,
      daysOff: 14,
      includesNights: true,
      nightsAtStart: true,
      nightDays: 14,
    },
    {
      name: "1 week on / 1 week off",
      description: "7 days on, 7 days off rotation",
      daysOn: 7,
      daysOff: 7,
      includesNights: true,
      nightsAtStart: true,
      nightDays: 7,
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

  // Generate schedules for all workers
  console.log("Generating schedules...")

  const allWorkers = await prisma.user.findMany({
    where: { organizationId: organization.id, role: "WORKER" },
    include: { crew: true },
  })

  const startDate = new Date()
  startDate.setMonth(0, 1) // January 1st of current year
  const endDate = new Date()
  endDate.setMonth(11, 31) // December 31st of current year

  for (const worker of allWorkers) {
    if (!defaultPattern) continue

    // Get crew phase offset for synchronized rotations
    const crewIndex = ["Crew A", "Crew B", "Crew C", "Crew D"].indexOf(worker.crew?.name || "")
    const phaseOffset = crewIndex >= 0 ? Math.floor((crewIndex * (defaultPattern.daysOn + defaultPattern.daysOff)) / 2) : 0

    const totalCycleDays = defaultPattern.daysOn + defaultPattern.daysOff
    let currentDate = new Date(startDate)
    let dayInCycle = phaseOffset % totalCycleDays

    // Delete existing schedules for this worker
    await prisma.schedule.deleteMany({
      where: {
        userId: worker.id,
        date: { gte: startDate, lte: endDate },
      },
    })

    // Generate schedules
    const schedules = []
    while (currentDate <= endDate) {
      let shiftType: "DAY" | "NIGHT" | "OFF"

      if (dayInCycle < defaultPattern.daysOn) {
        if (defaultPattern.includesNights && defaultPattern.nightsAtStart) {
          shiftType = dayInCycle < defaultPattern.nightDays ? "NIGHT" : "DAY"
        } else {
          shiftType = "DAY"
        }
      } else {
        shiftType = "OFF"
      }

      schedules.push({
        userId: worker.id,
        organizationId: organization.id,
        date: new Date(currentDate),
        shiftType,
      })

      currentDate.setDate(currentDate.getDate() + 1)
      dayInCycle = (dayInCycle + 1) % totalCycleDays
    }

    await prisma.schedule.createMany({ data: schedules })
    console.log(`Generated ${schedules.length} schedule days for ${worker.name}`)
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
