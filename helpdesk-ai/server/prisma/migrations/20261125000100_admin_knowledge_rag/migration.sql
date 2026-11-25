CREATE TABLE "KnowledgeDocument" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "format" TEXT NOT NULL CHECK ("format" IN ('txt','docx')),
  "text" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL UNIQUE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','APPROVED','ARCHIVED')),
  "uploadedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "approvedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "KnowledgeChunk" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ordinal" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "searchText" TEXT NOT NULL,
  UNIQUE ("documentId","ordinal")
);
CREATE INDEX "KnowledgeChunk_search_idx" ON "KnowledgeChunk" USING GIN (to_tsvector('english',"searchText"));
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");
ALTER TABLE "SimulationModule" ADD COLUMN "provenance" JSONB;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='helpdesk_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "KnowledgeDocument", "KnowledgeChunk" TO helpdesk_runtime;
  END IF;
END $$;
