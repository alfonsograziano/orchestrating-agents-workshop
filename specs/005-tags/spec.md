# Feature Specification: Tags

**Feature Branch**: `005-tags`
**Created**: 2026-09-12
**Status**: Draft
**Input**: User description: "Let me label ideas with tags and browse everything carrying a given tag."

> **Parallel execution**: this feature is built at the same time as `006-share-link` and `007-backup-json` by separate agents in separate worktrees. Read **File Ownership** below before writing anything. Staying inside your boundary is a hard requirement of this task, not a stylistic preference.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Label an idea (Priority: P1)

A user opens an idea and adds two tags to it — `side-project` and `writing`. The tags appear on the idea, and typing a tag that already exists elsewhere reuses it rather than creating a duplicate.

**Independent Test**: Open an idea, add a tag, reload the page, confirm the tag persists. Add the same tag to a second idea and confirm both ideas share one tag rather than two tags with identical names.

**Acceptance Scenarios**:

1. **Given** an idea with no tags, **When** the user adds `writing`, **Then** the tag appears on the idea and survives a reload.
2. **Given** one idea already tagged `writing`, **When** the user types `Writing` on another idea, **Then** the existing tag is reused — tag names are compared without regard to case or surrounding whitespace.
3. **Given** an idea tagged `writing`, **When** the user adds `writing` again, **Then** nothing changes and no duplicate appears.
4. **Given** an idea with three tags, **When** the user removes one, **Then** it disappears from that idea but remains available on any other idea that carries it.

---

### User Story 2 - Browse by tag (Priority: P2)

The user wants to see everything they have labelled `writing`. They open a tag browser, pick the tag, and see only the ideas carrying it.

**Independent Test**: Tag three of five ideas, open the tag browser, select the tag, confirm exactly those three appear.

**Acceptance Scenarios**:

1. **Given** several tags in use, **When** the user opens the tag browser, **Then** every tag in use is listed with a count of how many ideas carry it.
2. **Given** a tag carried by three ideas, **When** the user selects it, **Then** exactly those three ideas are shown.
3. **Given** a tag whose last idea has just been untagged, **When** the user returns to the browser, **Then** that tag is no longer offered.

---

### Edge Cases

- A tag name that is empty, whitespace-only, or absurdly long must be rejected before it reaches storage.
- Deleting an idea must not leave its tag links behind.
- A tag carried by no ideas must not linger in the tag list.
- Two ideas tagged in quick succession with the same new tag name must end up sharing one tag.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a user attach one or more tags to an idea and remove them individually.
- **FR-002**: Tag names MUST be trimmed and compared case-insensitively, so `Writing`, `writing`, and ` writing ` are the same tag.
- **FR-003**: System MUST preserve the casing the user first typed when displaying a tag.
- **FR-004**: Tag names MUST be 1–30 characters after trimming. Anything else MUST be rejected with a message the UI can show.
- **FR-005**: An idea MUST carry at most 10 tags. Exceeding this MUST be rejected, not silently truncated.
- **FR-006**: Attaching a tag an idea already carries MUST succeed without creating a duplicate.
- **FR-007**: System MUST expose the list of tags currently in use, each with the number of ideas carrying it.
- **FR-008**: System MUST expose the ideas carrying a given tag.
- **FR-008a**: The tag browser MUST be reachable from inside the running app without introducing a new URL route. Routing belongs to another agent this round.
- **FR-009**: Deleting an idea MUST remove its tag links, leaving no orphaned rows.
- **FR-010**: A tag carried by zero ideas MUST NOT appear in the tag list.
- **FR-011**: Tags MUST NOT affect an idea's stage, update history, or last-modified timestamp. Tagging is metadata, not tending.

### Key Entities

- **Tag**: A reusable label with a display name and a normalised form used for comparison and uniqueness.
- **IdeaTag**: The link between one idea and one tag. Unique per pair.

## File Ownership *(parallel-execution constraint)*

**You own these. Create or edit only these files:**

```
packages/shared/src/tags.schema.ts          (new)
apps/server/src/routes/tags.ts              (new — routes + this feature's table DDL)
apps/server/src/routes/tags.test.ts         (new)
apps/web/src/api/tags.ts                    (new)
apps/web/src/hooks/useTags.ts               (new)
apps/web/src/hooks/useTags.test.tsx         (new)
apps/web/src/components/TagChip.tsx         (new)
apps/web/src/components/TagEditor.tsx       (new)
apps/web/src/components/TagEditor.test.tsx  (new)
apps/web/src/components/TagBrowser.tsx      (new — an in-app panel, not a routed page)
apps/web/src/components/IdeaDetailModal.tsx (existing — yours alone; the tag editor mounts here)
apps/web/src/App.tsx                        (existing — yours alone; mount the browser panel here)
```

**Do not touch anything else.** In particular, do not edit `apps/server/src/db.ts`, `apps/server/src/app.ts`, `packages/shared/src/index.ts`, `apps/web/src/components/IdeaCard.tsx`, `apps/web/src/components/Header.tsx`, `apps/web/src/main.tsx`, or `apps/web/src/api/ideas.ts` — other agents own or share those. If you believe you need one of them, stop and say so rather than editing it.

**Two conventions that keep you inside the boundary:**

- Import schemas by subpath — `@idea-garden/shared/tags.schema` — not through the package barrel.
- Create your tables from inside your own route module using the `raw` handle on the database object, with `CREATE TABLE IF NOT EXISTS`. Do not add DDL to the shared schema constant.

## Success Criteria *(mandatory)*

- **SC-001**: A user can tag an idea and see the tag persist across a reload in under 10 seconds.
- **SC-002**: Tagging 20 ideas with the same name produces exactly one tag.
- **SC-003**: Selecting a tag returns exactly the ideas carrying it — no misses, no extras.
- **SC-004**: Deleting a tagged idea leaves zero orphaned tag links and removes now-unused tags from the list.
- **SC-005**: Tagging and untagging leave an idea's stage and update history untouched.

## Assumptions

- Single-user, single-laptop. No concurrency beyond what one browser can generate.
- Tags are flat. No hierarchy, colours, renaming, or merging.
- Tag data is not part of the export/import bundle being built in parallel; integrating the two is a follow-up.

## Out of Scope

- Filtering the main garden grid by tag. The tag browser is a separate view; do not modify the garden.
- Renaming or merging tags.
- Tag autocomplete ranked by usage. A plain list is enough.
