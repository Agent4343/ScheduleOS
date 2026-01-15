import { PrismaClient, ShiftType } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database with offshore operations data...")

  // Create offshore organization
  const organization = await prisma.organization.upsert({
    where: { slug: "offshore-fpso" },
    update: {},
    create: {
      name: "Offshore FPSO Operations",
      slug: "offshore-fpso",
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
      name: "21/21 Standard",
      description: "21 days on, 21 days off - standard offshore rotation",
      daysOn: 21,
      daysOff: 21,
      includesNights: false,
      alternatesDayNight: false,
      isDefault: true,
    },
    {
      name: "21/21 Alternating",
      description: "21 days on, 21 days off - alternates day/night hitches",
      daysOn: 21,
      daysOff: 21,
      includesNights: true,
      alternatesDayNight: true,
      isDefault: false,
    },
    {
      name: "14/14 OCR",
      description: "14 days on, 14 days off - control room operators",
      daysOn: 14,
      daysOff: 14,
      includesNights: false,
      alternatesDayNight: false,
      isDefault: false,
    },
  ]

  const patternMap: Record<string, string> = {}

  for (const pattern of patterns) {
    const created = await prisma.rotationPattern.upsert({
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
    patternMap[pattern.name] = created.id
  }

  console.log("Created rotation patterns")

  // Create rotation groups (replacing generic crews)
  const rotationGroups = [
    { name: "Rotation 151", code: "151", color: "#3B82F6", alternatesDayNight: false, patternName: "21/21 Standard" },
    { name: "Rotation 351", code: "351", color: "#10B981", alternatesDayNight: true, patternName: "21/21 Alternating" },
    { name: "Rotation 352", code: "352", color: "#F59E0B", alternatesDayNight: true, patternName: "21/21 Alternating" },
    { name: "Rotation 451", code: "451", color: "#8B5CF6", alternatesDayNight: true, patternName: "21/21 Alternating" },
    { name: "OCR Rotation", code: "OCR", color: "#EF4444", alternatesDayNight: false, patternName: "14/14 OCR" },
  ]

  const groupMap: Record<string, string> = {}

  for (const group of rotationGroups) {
    const created = await prisma.crew.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: group.name,
        },
      },
      update: {
        code: group.code,
        alternatesDayNight: group.alternatesDayNight,
        rotationPatternId: patternMap[group.patternName],
      },
      create: {
        name: group.name,
        code: group.code,
        color: group.color,
        alternatesDayNight: group.alternatesDayNight,
        organizationId: organization.id,
        rotationPatternId: patternMap[group.patternName],
      },
    })
    groupMap[group.code] = created.id
  }

  console.log("Created rotation groups")

  // Create positions for staffing requirements
  const positions = [
    { name: "OIM", code: "OIM", category: "Leadership", shiftType: "24hr", minStaffing: 1, maxStaffing: 1, sortOrder: 1 },
    { name: "Production Supervisor", code: "PS", category: "Leadership", shiftType: "24hr", minStaffing: 1, maxStaffing: 1, sortOrder: 2 },
    { name: "Production Lead - Days", code: "PL-D", category: "Leadership", shiftType: "day", minStaffing: 1, maxStaffing: 1, sortOrder: 3 },
    { name: "Production Lead - Nights", code: "PL-N", category: "Leadership", shiftType: "night", minStaffing: 1, maxStaffing: 1, sortOrder: 4 },
    { name: "OCR Operator - Day Slot 1", code: "OCR-D1", category: "Control Room", shiftType: "day", minStaffing: 1, maxStaffing: 1, sortOrder: 5, requiredQualifications: [] },
    { name: "OCR Operator - Day Slot 2", code: "OCR-D2", category: "Control Room", shiftType: "day", minStaffing: 1, maxStaffing: 1, sortOrder: 6, requiredQualifications: [] },
    { name: "OCR Operator - Night Slot 1", code: "OCR-N1", category: "Control Room", shiftType: "night", minStaffing: 1, maxStaffing: 1, sortOrder: 7, requiredQualifications: [] },
    { name: "OCR Operator - Night Slot 2", code: "OCR-N2", category: "Control Room", shiftType: "night", minStaffing: 1, maxStaffing: 1, sortOrder: 8, requiredQualifications: [] },
    { name: "Outside Ops - Day", code: "OSO-D", category: "Field Ops", shiftType: "day", minStaffing: 4, maxStaffing: 5, sortOrder: 9 },
    { name: "Outside Ops - Night", code: "OSO-N", category: "Field Ops", shiftType: "night", minStaffing: 3, maxStaffing: 4, sortOrder: 10 },
  ]

  for (const position of positions) {
    await prisma.position.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: position.name,
        },
      },
      update: {},
      create: {
        ...position,
        requiredQualifications: position.requiredQualifications || [],
        organizationId: organization.id,
      },
    })
  }

  console.log("Created positions")

  // Create admin user
  const passwordHash = await bcrypt.hash("demo1234", 12)

  const admin = await prisma.user.upsert({
    where: { email: "admin@offshore.com" },
    update: {},
    create: {
      email: "admin@offshore.com",
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: organization.id,
    },
  })

  console.log("Created admin user:", admin.email)

  // Create offshore personnel from spec
  const personnel = [
    // OIMs - Rotation 151
    { name: "Peter Brophy", email: "peter.brophy@offshore.com", group: "151", position: "OIM", qualifications: [] },
    { name: "Jeremy Baldwin", email: "jeremy.baldwin@offshore.com", group: "151", position: "OIM", qualifications: [] },

    // Production Supervisors - Rotation 151
    { name: "Brad Pelley", email: "brad.pelley@offshore.com", group: "151", position: "Production Supervisor", qualifications: [] },
    { name: "Lee LeDrew", email: "lee.ledrew@offshore.com", group: "151", position: "Production Supervisor", qualifications: [] },

    // Production Leads - Rotation 451
    { name: "Stephen Boyd", email: "stephen.boyd@offshore.com", group: "451", position: "Production Lead", qualifications: [] },
    { name: "Jarrett Conway", email: "jarrett.conway@offshore.com", group: "451", position: "Production Lead", qualifications: [] },
    { name: "Jon Warford", email: "jon.warford@offshore.com", group: "451", position: "Production Lead", qualifications: [] },
    { name: "Mike Knox", email: "mike.knox@offshore.com", group: "451", position: "Production Lead", qualifications: [] },

    // OCR Operators - 14/14 Rotation
    { name: "Andrew Lawlor", email: "andrew.lawlor@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },
    { name: "Phil Savory", email: "phil.savory@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },
    { name: "Keefer Lockwood", email: "keefer.lockwood@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },
    { name: "Rob Benoit", email: "rob.benoit@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },
    { name: "Matt Harris", email: "matt.harris@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },
    { name: "Neil King", email: "neil.king@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },
    { name: "Shawn Kennedy", email: "shawn.kennedy@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },
    { name: "Dwayne Maloney", email: "dwayne.maloney@offshore.com", group: "OCR", position: "OCR Operator", qualifications: [] },

    // Ops Techs - Rotation 151 (some CCR qualified marked with *)
    { name: "Lucas Ellsworth", email: "lucas.ellsworth@offshore.com", group: "151", position: "Ops Tech", qualifications: [] },
    { name: "Greg Mooney", email: "greg.mooney@offshore.com", group: "151", position: "Ops Tech", qualifications: ["CCR"], isCCR: true },
    { name: "Bern Broaders", email: "bern.broaders@offshore.com", group: "151", position: "Ops Tech", qualifications: ["CCR"], isCCR: true },
    { name: "Steve Ennis", email: "steve.ennis@offshore.com", group: "151", position: "Ops Tech", qualifications: [] },
    { name: "Rod Nippard", email: "rod.nippard@offshore.com", group: "151", position: "Ops Tech", qualifications: [] },
    { name: "Evan Hanrahan", email: "evan.hanrahan@offshore.com", group: "151", position: "Ops Tech", qualifications: [] },
    { name: "Chris Elliott", email: "chris.elliott@offshore.com", group: "151", position: "Ops Tech", qualifications: ["CCR"], isCCR: true },
    { name: "Ildo Santiago", email: "ildo.santiago@offshore.com", group: "151", position: "Ops Tech", qualifications: ["CCR"], isCCR: true },

    // Ops Techs - Rotation 351
    { name: "Scott Snow", email: "scott.snow@offshore.com", group: "351", position: "Ops Tech", qualifications: [] },
    { name: "Jordan Mercer", email: "jordan.mercer@offshore.com", group: "351", position: "Ops Tech", qualifications: [] },
    { name: "Sheldon Greening", email: "sheldon.greening@offshore.com", group: "351", position: "Ops Tech", qualifications: [] },
    { name: "Shawn Oakley", email: "shawn.oakley@offshore.com", group: "351", position: "Ops Tech", qualifications: [] },

    // Ops Techs - Rotation 352
    { name: "Josh Dowden", email: "josh.dowden@offshore.com", group: "352", position: "Ops Tech", qualifications: [] },
    { name: "Mitch Scott", email: "mitch.scott@offshore.com", group: "352", position: "Ops Tech", qualifications: [] },
    { name: "Jordan Riggs", email: "jordan.riggs@offshore.com", group: "352", position: "Ops Tech", qualifications: ["CCR"], isCCR: true },
    { name: "Mike Meehan", email: "mike.meehan@offshore.com", group: "352", position: "Ops Tech", qualifications: ["CCR"], isCCR: true },

    // Ops Techs - Rotation 451
    { name: "Grant Hughes", email: "grant.hughes@offshore.com", group: "451", position: "Ops Tech", qualifications: [] },
    { name: "Howard Sangster", email: "howard.sangster@offshore.com", group: "451", position: "Ops Tech", qualifications: [] },
    { name: "Roy Connors", email: "roy.connors@offshore.com", group: "451", position: "Ops Tech", qualifications: [] },
  ]

  for (const person of personnel) {
    await prisma.user.upsert({
      where: { email: person.email },
      update: {
        crewId: groupMap[person.group],
        rotationGroup: person.group,
        primaryPosition: person.position,
        isCCRQualified: (person as { isCCR?: boolean }).isCCR || false,
        qualifications: person.qualifications,
      },
      create: {
        email: person.email,
        name: person.name,
        passwordHash,
        role: "WORKER",
        position: person.position,
        status: "ACTIVE",
        organizationId: organization.id,
        crewId: groupMap[person.group],
        rotationGroup: person.group,
        primaryPosition: person.position,
        isCCRQualified: (person as { isCCR?: boolean }).isCCR || false,
        qualifications: person.qualifications,
      },
    })
  }

  console.log(`Created ${personnel.length} offshore personnel`)

  // Create staffing rules
  const staffingRules = [
    { name: "Outside Ops Day Minimum", shiftType: ShiftType.DAY, minWorkers: 4, maxVacation: 1 },
    { name: "Outside Ops Night Minimum", shiftType: ShiftType.NIGHT, minWorkers: 3, maxVacation: 1 },
    { name: "OCR Day Minimum", shiftType: ShiftType.OCR_DAY, minWorkers: 2, maxVacation: 0 },
    { name: "OCR Night Minimum", shiftType: ShiftType.OCR_NIGHT, minWorkers: 2, maxVacation: 0 },
  ]

  for (const rule of staffingRules) {
    await prisma.staffingRule.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: rule.name,
        },
      },
      update: {},
      create: {
        ...rule,
        organizationId: organization.id,
      },
    })
  }

  console.log("Created staffing rules")

  // Generate sample schedules for all personnel
  console.log("Generating schedules...")

  const allWorkers = await prisma.user.findMany({
    where: { organizationId: organization.id, role: "WORKER" },
    include: { crew: { include: { rotationPattern: true } } },
  })

  const startDate = new Date()
  startDate.setMonth(0, 1) // January 1st of current year
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date()
  endDate.setMonth(11, 31) // December 31st of current year
  endDate.setHours(0, 0, 0, 0)

  // Group personnel by rotation group for phase offset
  const groupPhaseOffsets: Record<string, number> = {
    "151": 0,
    "351": 0,
    "352": 7, // Offset by ~7 days from 351
    "451": 14,
    "OCR": 0,
  }

  // Track hitch count per user for day/night alternation
  const userHitchCount: Record<string, number> = {}

  for (const worker of allWorkers) {
    if (!worker.crew?.rotationPattern) continue

    const pattern = worker.crew.rotationPattern
    const totalCycleDays = pattern.daysOn + pattern.daysOff
    const phaseOffset = groupPhaseOffsets[worker.rotationGroup || "151"] || 0

    // Delete existing schedules
    await prisma.schedule.deleteMany({
      where: {
        userId: worker.id,
        date: { gte: startDate, lte: endDate },
      },
    })

    const schedules = []
    const currentDate = new Date(startDate)
    let dayInCycle = phaseOffset % totalCycleDays
    let hitchCount = 0

    while (currentDate <= endDate) {
      let shiftType: ShiftType

      const isWorkingDay = dayInCycle < pattern.daysOn

      if (isWorkingDay) {
        // Working days
        if (worker.primaryPosition === "OCR Operator") {
          // OCR operators use OCR_DAY/OCR_NIGHT
          // Simple alternation based on hitch count
          shiftType = hitchCount % 2 === 0 ? ShiftType.OCR_DAY : ShiftType.OCR_NIGHT
        } else if (worker.crew?.alternatesDayNight) {
          // Alternating groups (351, 352, 451) - full hitch is day or night
          shiftType = hitchCount % 2 === 0 ? ShiftType.DAY : ShiftType.NIGHT
        } else {
          // Standard groups - just days
          shiftType = ShiftType.DAY
        }
      } else {
        // Off days
        shiftType = ShiftType.OFF
      }

      schedules.push({
        userId: worker.id,
        crewId: worker.crewId,
        date: new Date(currentDate),
        shiftType,
        isOverride: false,
        isBackfill: false,
      })

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
      const prevDayInCycle = dayInCycle
      dayInCycle = (dayInCycle + 1) % totalCycleDays

      // Track when starting a new working hitch
      if (prevDayInCycle >= pattern.daysOn && dayInCycle < pattern.daysOn) {
        hitchCount++
      }
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
