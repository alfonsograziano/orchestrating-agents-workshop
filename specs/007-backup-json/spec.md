# Feature Specification: Export / Import as JSON

**Feature Branch**: `007-backup-json`
**Created**: 2026-09-12
**Status**: Draft
**Input**: User description: "Let me download my whole garden as a JSON file and load one back in."

> **Parallel execution**: this feature is built at the same time as `005-tags` and `006-share-link` by separate agents in separate worktrees. Read **File Ownership** below before writing anything. Staying inside your boundary is a hard requirement of this task, not a stylistic preference.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Take my garden with me (Priority: P1)

A user wants a copy of everything they have written. They export, and a JSON file lands on their machine containing every idea and every watering.

**Independent Test**: With several ideas and updates present, export, and confirm the file contains all of them with their notes, stages and timestamps intact.

**Acceptance Scenarios**:

1. **Given** five ideas with twelve updates between them, **When** the user exports, **Then** the file contains all five ideas and all twelve updates.
2. **Given** an empty garden, **When** the user exports, **Then** a valid, well-formed file is produced describing an empty garden — not an error.
3. **Given** an export file, **When** it is inspected, **Then** it declares the format version it was written in.

---

### User Story 2 - Load a garden back (Priority: P2)

The user picks a previously exported file. Its contents are added to their garden, with every idea's history intact and its plant at the right stage.

**Independent Test**: Export a garden, clear the database, import the file, and confirm every idea and update returns with the same stages.

**Acceptance Scenarios**:

1. **Given** a valid export file, **When** the user imports it, **Then** its ideas and updates are added and immediately visible.
2. **Given** an imported idea that had six waterings, **When** the user views it, **Then** it sits at the stage its waterings justify and shows all six entries.
3. **Given** an imported idea, **When** the user waters it, **Then** it advances normally from where it stands.
4. **Given** a file containing an idea that is already present, **When** the user imports it, **Then** the outcome is stated up front and applied consistently — the user is never left guessing whether something was duplicated.

---

### User Story 3 - Refuse bad input safely (Priority: P3)

The user picks the wrong file. Nothing happens to their garden, and they are told why.

**Independent Test**: Import a file that is not valid JSON, one that is valid JSON but the wrong shape, and one that is the right shape with an invalid field. Confirm the garden is untouched after each and that each produces a distinct, readable message.

**Acceptance Scenarios**:

1. **Given** a file that is not JSON, **When** the user imports it, **Then** the garden is unchanged and the user is told the file could not be read.
2. **Given** a file whose ideas are individually valid but one update references an idea that is not in the file, **When** the user imports it, **Then** nothing at all is written.
3. **Given** a file large enough to be abusive, **When** it is submitted, **Then** it is refused before being parsed in full.

---

### Edge Cases

- An import that fails partway must leave the garden exactly as it was. There is no acceptable half-imported state.
- An idea's stage in the file must not be trusted over its waterings. The two can disagree, and the waterings are the truth.
- An update whose stage or note violates the rules the app enforces elsewhere must be rejected, not written.
- A file from a future format version must be refused clearly rather than partially understood.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST export every idea and every update as a single JSON document.
- **FR-002**: The export MUST carry a format version and the moment it was taken.
- **FR-003**: The export MUST be valid for an empty garden.
- **FR-004**: System MUST accept a previously exported document and add its contents to the garden.
- **FR-005**: Import MUST validate the whole document before writing anything.
- **FR-006**: Import MUST be all-or-nothing. A failure at any point MUST leave the garden byte-for-byte as it was.
- **FR-007**: Import MUST NOT trust an idea's stage from the file. An imported idea's stage MUST be derived from its waterings exactly as it is for an idea created in the app.
- **FR-008**: Import MUST enforce the same field rules the rest of the app enforces — title and note lengths, stage range, required fields.
- **FR-009**: Import MUST reject a document whose format version it does not understand.
- **FR-010**: Import MUST define and apply one stated rule for an idea that already exists, and MUST report what it did.
- **FR-011**: Import MUST reject a document above a stated size limit before fully parsing it.
- **FR-012**: Import MUST report, on success, how many ideas and updates were added.
- **FR-013**: An imported idea MUST be indistinguishable from one created in the app — waterable, editable, and correct on reload.

### Key Entities

- **Backup document**: A versioned envelope carrying when it was taken, the ideas, and the updates belonging to them.

## File Ownership *(parallel-execution constraint)*

**You own these. Create or edit only these files:**

```
packages/shared/src/backup.schema.ts             (new)
apps/server/src/routes/backup.ts                 (new)
apps/server/src/routes/backup.test.ts            (new)
apps/web/src/api/backup.ts                       (new)
apps/web/src/components/BackupControls.tsx       (new)
apps/web/src/components/BackupControls.test.tsx  (new)
apps/web/src/components/Header.tsx               (existing — yours alone; the controls mount here)
```

**Do not touch anything else.** In particular, do not edit `apps/server/src/db.ts`, `apps/server/src/app.ts`, `packages/shared/src/index.ts`, `apps/web/src/components/IdeaCard.tsx`, `apps/web/src/components/IdeaDetailModal.tsx`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, or `apps/web/src/api/ideas.ts` — other agents own or share those. If you believe you need one of them, stop and say so rather than editing it.

**Two conventions that keep you inside the boundary:**

- Import schemas by subpath — `@idea-garden/shared/backup.schema` — not through the package barrel.
- This feature needs no new tables. Reach the existing ones through the `raw` handle on the database object, and do your writes inside a single transaction so FR-006 holds.

## Success Criteria *(mandatory)*

- **SC-001**: Export then import into an empty database reproduces the original garden exactly — same ideas, same updates, same stages.
- **SC-002**: 100% of malformed, wrong-shape, wrong-version and oversized documents leave the garden completely unchanged.
- **SC-003**: An idea imported with a deliberately wrong stage in the file ends up at the stage its waterings justify.
- **SC-004**: An imported idea accepts a watering and advances correctly.
- **SC-005**: Every rejection produces a message that tells the user what was wrong.

## Assumptions

- Single-user, single-laptop. No streaming or background jobs; a garden fits comfortably in memory.
- The bundle covers ideas and updates only. Tags, built in parallel, are out of scope here; combining them is a follow-up.
- The browser's ordinary download and file-picker behaviour is sufficient. No filesystem integration.
- Export is a snapshot, not a sync. There is no notion of merging changes made after an export.

## Out of Scope

- Any format other than JSON.
- Scheduled or automatic backups.
- Selective export of a subset of ideas.
- Migrating documents between format versions.
