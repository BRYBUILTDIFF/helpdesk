ALTER TABLE "KnowledgeDocument" ADD COLUMN "familyId" TEXT;
UPDATE "KnowledgeDocument" SET "familyId"="id";
CREATE UNIQUE INDEX "KnowledgeDocument_family_version_key" ON "KnowledgeDocument" ("familyId","version");
