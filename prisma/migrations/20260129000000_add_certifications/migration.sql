-- CreateTable
CREATE TABLE "CertificationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CertificationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCertification" (
    "id" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "certificationTypeId" TEXT NOT NULL,

    CONSTRAINT "UserCertification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificationType_organizationId_idx" ON "CertificationType"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationType_organizationId_name_key" ON "CertificationType"("organizationId", "name");

-- CreateIndex
CREATE INDEX "UserCertification_userId_idx" ON "UserCertification"("userId");

-- CreateIndex
CREATE INDEX "UserCertification_certificationTypeId_idx" ON "UserCertification"("certificationTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCertification_userId_certificationTypeId_key" ON "UserCertification"("userId", "certificationTypeId");

-- AddForeignKey
ALTER TABLE "CertificationType" ADD CONSTRAINT "CertificationType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_certificationTypeId_fkey" FOREIGN KEY ("certificationTypeId") REFERENCES "CertificationType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
