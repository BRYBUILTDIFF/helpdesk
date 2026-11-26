# Admin simulation RAG

AI simulation drafts are generated only from the **Knowledge Sources** admin page. Generation retrieves approved knowledge passages before calling the configured AI provider. The **Suggestion Queue** is a read-only view of common eligible IT help requests, with search and refresh; it has no generation or dismissal controls. User chat has not been converted to RAG.

Students can expand **Sources for this simulation** in terminal and Windows simulation views. This read-only section loads published document snapshots, highlights passages supporting the current step, and identifies AI-added explanations. The authenticated `/api/simulations/modules/:id/sources` endpoint rejects unpublished modules and exposes only document titles, versions, sections, passage text, and step citation labels. It does not expose administrative provenance, source filenames, uploader/reviewer identities, original files, or draft metadata. Manual modules show that no published passages are available.

## Workflow

The source library places uploads on the left and document management on the right. Each row shows its upload date, version, and saved-simulation usage. Open a source to rename it, review extracted text, inspect **Used by**, or open its **Versions** history. Renaming updates future search text; published snapshots retain the original name and text.

**Delete** permanently removes the entire source family: all versions, extracted document text, and searchable passages. Its confirmation previews the version/passage counts and saved simulation/draft references and requires typing `DELETE`. The authenticated admin API also requires the exact previewed version IDs and rejects a stale version list. Source chunks are removed transactionally by the database cascade. This frees library storage and allows the content to be uploaded again. Saved simulation, revision, and draft evidence snapshots are separate copies and are retained; deletion is not an erasure of those snapshots. Drafts or evidence previews referencing deleted sources cannot be newly generated/published without approved replacement evidence. No existing source is deleted automatically by deploying this feature.

Use **Upload new version** inside a source to keep a revised guide in the same family, even if its filename changes. The revision starts as a draft. Approving a version archives other approved versions in that family, so future searches use only one approved version. Existing published simulations keep their stored snapshots; archived sources still prevent new publication of drafts that depend on them. Old versions can be reopened and restored to draft for review. Archive confirmation explains the impact; archiving neither deletes text nor frees the storage quota. Duplicate-upload errors link to the existing source.

**Find supporting passages** returns a signed preview bound to the current admin, prompt, exact passages, and a 10-minute expiry. Knowledge Sources sends this preview with generation rather than repeating retrieval. The backend validates the signature and rechecks source approval/version/content before generation. If the preview expires or a source is revoked, search again. Legacy API calls without a preview continue to retrieve server-side; the current admin UI always sends the preview.

1. In **Knowledge Sources**, upload up to ten Word `.docx` or UTF-8 `.txt` files per batch, at most 2 MB each. Legacy `.doc`, PDFs, and image-only documents are not supported.
2. Read the extracted text and approve relevant sources. Extraction uses raw text, never converted HTML. Common credential patterns are redacted; review source material privately before uploading because automated redaction is not exhaustive.
3. Enter a simulation request that describes both the issue and surface, such as “Windows Terminal account lockout recovery using PowerShell.” Search the approved passages and generate a draft. Prompt patterns in the queue can inform which guides to upload, but generation takes place only in Knowledge Sources.
4. In the existing editor, inspect the **Supporting knowledge** panel and each step's supporting passage checkboxes. Edit instructions and commands normally. Changing a step resets the existing test and source-review confirmation.
5. Confirm source support, complete the existing interactive test for terminal modules, and save. Existing enable/publish behavior remains. A source-backed module cannot be newly published using a revoked or archived source.

The provider is instructed to use retrieved passages as reference data, never as executable instructions. Missing evidence, unavailable AI, insufficient evidence, malformed output, or unknown citation IDs do not create a fallback template labeled as RAG. The admin must verify factual support; a valid source ID alone does not prove the generated claim.

Generation can supplement partial evidence with general AI knowledge. Each step stores `supportType`: `source-backed` requires valid passage citations; `ai-added` must have an empty `sourceIds` array and is marked as requiring independent review in the editor. At least one step must remain source-backed. Missing or unrelated evidence still blocks generation. Admins may change a step's evidence classification and citations; doing so resets verification and review confirmation. Publishing requires review of both the cited evidence and AI additions. The executable command catalog and terminal test remain mandatory for every terminal step.

For terminal drafts, expected outputs are calculated by the simulator from the ordered actions rather than copied from AI output. Generated commands, action IDs, surface compatibility, and step order must pass runtime validation before a draft is saved. Output edits made later in the editor still undergo strict validation during testing. The read-only queue includes patterns even if a module already exists or a suggestion was previously dismissed; counts describe only the sampled recent eligible policy events, not every chat message or lifetime totals.

## Deploy in this order

These are new schema changes. The implementation does not apply them to Render or deploy either service automatically.

The version-management update adds `KnowledgeDocument.familyId` and a family/version unique index through `20261126000100_knowledge_source_families`. Existing documents are backfilled into separate families; existing unrelated uploads are not automatically merged. Apply this migration before deploying the updated backend. The local development database has been migrated; production remains separate.

1. Take and verify a database backup using your established maintenance procedure.
2. From `helpdesk-ai/server`, apply migrations with the private owner configuration:

   ```powershell
   npm.cmd run migrate:deploy -- --env-file .security/render-owner.env
   ```

3. The migration grants the two new tables to `helpdesk_runtime` if that role exists. If your API uses another runtime role, grant just these tables without rotating credentials:

   ```powershell
   node scripts/grant-knowledge-tables.js --env-file .security/render-owner.env --role YOUR_RUNTIME_ROLE
   ```

4. Deploy the Render backend using the updated dependency lockfile. Its build must install dependencies and run `npm run generate` to regenerate Prisma. Keep the existing production database, JWT, encryption, and admin verification settings.
5. Deploy the updated Vercel frontend. No additional embedding service, pgvector extension, or browser API key is needed.
6. Upload a small approved guide, inspect extracted text, approve it, retrieve evidence for a matching request, generate, review, test, save, and publish. Confirm an ordinary user cannot access knowledge-management endpoints.

The normal DeepSeek configuration applies: `AI_PROVIDER=deepseek`, `AI_BASE_URL=https://api.deepseek.com`, a supported `AI_MODEL` such as `deepseek-flash`, and the private provider key in Render. This feature does not repair invalid provider credentials or exhausted API balance.

For local development, run migrations against an explicitly selected local owner and run `npm run generate` after installing dependencies. Do not use production owner credentials in the API process.

## Storage and traceability

- `KnowledgeDocument` stores immutable extracted text, filename, content hash, source version, approval state, and actor metadata. Original file binaries are not retained. Upload a changed guide as a new document and archive its predecessor.
- `KnowledgeChunk` stores overlapping passages of up to 1,200 characters and stable section numbers. A PostgreSQL GIN expression index supports English full-text retrieval. No vector extension is needed.
- Retrieval selects up to six passages, at most two per source, from approved documents only. It is a lexical baseline: paraphrases and other languages may need query improvements or semantic retrieval later. A match is evidence to review, not an accuracy guarantee.
- Source snapshots, per-step citation IDs, and generation metadata persist with the saved draft. Reviewed provenance is copied to the module and append-only module revision when saved. Student module listings do not include the full admin source passages.
- Unapproving or archiving excludes a source from future retrieval and prevents new publication using it. Existing published simulations retain their historical source snapshot; this is not automatic withdrawal of already-published content.
- The library is limited to 200 documents and 5 million extracted characters, including archived documents. Individual extracted text is limited to 200,000 characters. Duplicate extracted content is rejected. Archiving does not free storage quota; the database owner should review retention when limits are reached.
- Word archives are checked before parsing: at most 1,000 entries and 8 MB declared expanded size, no encrypted entries. Upload processing is bounded and synchronous; each file gets a success/error result. Successfully committed files survive a later batch failure. A retry may report those files as duplicates.
- Only admins can upload, inspect, approve, archive, search knowledge, or generate simulations. Existing MFA, request limits, AI budgets, and admin auditing still apply. API audit events record operations rather than extracted content.

## Verification

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd ru

```

The integration runner regenerates Prisma before loading the client, then reads only the local owner file (or `RAG_TEST_ADMIN_URL`), refuses remote database hosts, creates an isolated temporary database, runs every migration, and drops that database after testing. It covers authorization, upload results, approval, real full-text retrieval, provenance, source review, terminal test receipts, source revocation, and publication. Provider responses are substituted; this does not establish live model correctness or retrieval quality on your final research corpus.

Evaluate the actual deployed corpus with a held-out set of requests, expected supporting sections, incorrect/missing-source cases, citation-support ratings, and generation latency before reporting research results.

If an older test run returns HTTP 500 while saving a module, regenerate Prisma with `npm.cmd run generate` and restart any running backend process. A stale client does not recognize the new `SimulationModule.provenance` column, even if the migration succeeded. The updated integration runner performs generation automatically.
