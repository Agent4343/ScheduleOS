// Mock for @prisma/client enums and classes for testing

// Mock PrismaClient for testing
export class PrismaClient {
  user = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => ({}),
  }
  organization = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => ({}),
  }
  $connect = async () => {}
  $disconnect = async () => {}
}

export enum ShiftType {
  DAY = 'DAY',
  NIGHT = 'NIGHT',
  OFF = 'OFF',
  VACATION = 'VACATION',
  SICK = 'SICK',
  TRAINING = 'TRAINING',
  SHUTDOWN = 'SHUTDOWN',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  WORKER = 'WORKER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
}

export enum TimeOffType {
  VACATION = 'VACATION',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  BEREAVEMENT = 'BEREAVEMENT',
  JURY_DUTY = 'JURY_DUTY',
  OTHER = 'OTHER',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  CANCELLED = 'CANCELLED',
}

export enum NotificationType {
  SCHEDULE_CHANGE = 'SCHEDULE_CHANGE',
  TIME_OFF_REQUEST = 'TIME_OFF_REQUEST',
  TIME_OFF_APPROVED = 'TIME_OFF_APPROVED',
  TIME_OFF_DENIED = 'TIME_OFF_DENIED',
  STAFFING_ALERT = 'STAFFING_ALERT',
  SHIFT_SWAP = 'SHIFT_SWAP',
  SYSTEM = 'SYSTEM',
}
