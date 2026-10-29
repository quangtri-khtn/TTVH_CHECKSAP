-- CreateTable
CREATE TABLE "sap_query_defs" (
    "key" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactBadges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedPlaceholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "baselineColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dedupKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportsExtraColumns" BOOLEAN NOT NULL DEFAULT true,
    "defaultSql" TEXT NOT NULL,
    "currentVersionNo" INTEGER NOT NULL DEFAULT 1,
    "lastTestedSqlHash" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestedById" TEXT,
    "lastTestRowCount" INTEGER,
    "lastTestDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sap_query_defs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "sap_query_versions" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "sqlText" TEXT NOT NULL,
    "sqlHash" TEXT NOT NULL,
    "changeNote" TEXT NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sap_query_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sap_query_audits" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromVersion" INTEGER,
    "toVersion" INTEGER,
    "beforeSql" TEXT,
    "afterSql" TEXT,
    "changeNote" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sap_query_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sap_query_defs_flow_sortOrder_idx" ON "sap_query_defs"("flow", "sortOrder");

-- CreateIndex
CREATE INDEX "sap_query_versions_queryKey_versionNo_idx" ON "sap_query_versions"("queryKey", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "sap_query_versions_queryKey_versionNo_key" ON "sap_query_versions"("queryKey", "versionNo");

-- CreateIndex
CREATE INDEX "sap_query_audits_queryKey_createdAt_idx" ON "sap_query_audits"("queryKey", "createdAt");

-- AddForeignKey
ALTER TABLE "sap_query_versions" ADD CONSTRAINT "sap_query_versions_queryKey_fkey" FOREIGN KEY ("queryKey") REFERENCES "sap_query_defs"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sap_query_audits" ADD CONSTRAINT "sap_query_audits_queryKey_fkey" FOREIGN KEY ("queryKey") REFERENCES "sap_query_defs"("key") ON DELETE CASCADE ON UPDATE CASCADE;
