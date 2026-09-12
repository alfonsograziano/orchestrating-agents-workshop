# Feature Specification: Archive Ideas

**Feature Branch**: `004-archive-ideas`
**Created**: 2026-09-12
**Status**: Draft
**Input**: User description: "Archive instead of delete. An archived idea is frozen — you can still read it, but nothing about it can change. Archived ideas live on their own page, and you can unarchive them to bring them back into the garden."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clear a dead idea out of the garden without losing it (Priority: P1)

A user has an idea they stopped tending months ago. It clutters the grid but they are not ready to lose the eight waterings of history attached to it. They open the idea, choose "Archive idea", and it disappears from the garden. The grid count drops by one. Nothing about the idea's content is lost.

**Why this priority**: This is the feature. Without it the other three stories have nothing to operate on, and the garden has no non-destructive way to shed clutter — today the only option is permanent deletion.

**Independent Test**: Archive an idea from the garden, confirm it disappears from the grid and the header count decrements, then reload the page and confirm it is still gone from the garden and still exists in the archive.

**Acceptance Scenarios**:

1. **Given** a garden with five ideas, **When** the user archives one, **Then** the grid shows four cards, the header count reads four, and no archived card appears anywhere in the garden view.
2. **Given** an idea at stage 7 with six updates, **When** the user archives it, **Then** its stage and its full update history are preserved unchanged.
3. **Given** the user has archived the last remaining idea, **When** the garden re-renders, **Then** the empty-garden state appears exactly as it does for a genuinely empty garden.
4. **Given** the server rejects the archive request, **When** the user attempts it, **Then** the idea remains in the garden and a user-visible error appears. The card does not optimistically vanish and then reappear.

---

### User Story 2 - Read the archive on its own page (Priority: P2)

The user wants to look back at what they have set aside. They navigate to the archive and see every archived idea, each showing the stage it was frozen at. They open one and read its title, description, and full timeline — but there is nothing on screen to change it with.

**Why this priority**: Archiving without a way to see the result is a deletion with extra steps. This story is what makes archiving feel safe.

**Independent Test**: Archive two ideas, navigate to the archive page, confirm both appear with their correct frozen stages, open one, and confirm the detail view is read-only — no watering form, no edit affordance, no per-entry menus.

**Acceptance Scenarios**:

1. **Given** three archived ideas, **When** the user opens the archive page, **Then** all three are listed and no active idea appears among them.
2. **Given** an empty archive, **When** the user opens the archive page, **Then** an empty state explains that archived ideas will appear there.
3. **Given** an archived idea with four updates, **When** the user opens its detail view, **Then** the title, description, plant at its frozen stage, and all four timeline entries are visible, and the watering form is absent.
4. **Given** the user is on the archive page, **When** they look for a way back, **Then** a navigation affordance returns them to the garden.

---

### User Story 3 - Bring an idea back (Priority: P3)

Something reminds the user of an idea they archived. They find it in the archive, unarchive it, and it returns to the garden exactly as it was — same stage, same history — and can be watered again immediately.

**Why this priority**: Reversibility is what separates this from delete. It is lower priority than reading the archive only because a user must be able to see an idea before restoring it.

**Independent Test**: Archive an idea at stage 5, unarchive it, confirm it reappears in the garden at stage 5 with its history intact, then water it and confirm it advances to stage 6.

**Acceptance Scenarios**:

1. **Given** an archived idea at stage 5, **When** the user unarchives it, **Then** it leaves the archive, appears in the garden at stage 5, and the header count increments.
2. **Given** an idea that was just unarchived, **When** the user waters it, **Then** the watering succeeds and the stage advances normally.
3. **Given** an idea archived at stage 16, **When** it is unarchived, **Then** it is still at stage 16 and still displays as fully bloomed.

---

### User Story 4 - Delete permanently, deliberately (Priority: P4)

The user is certain an archived idea is worthless. From the archive, they delete it for good, confirming through the existing destructive-action dialog.

**Why this priority**: Permanent deletion already exists; this story only relocates it. It is last because nothing depends on it.

**Independent Test**: Archive an idea, delete it from the archive, confirm it is gone from both the archive and the garden after a reload.

**Acceptance Scenarios**:

1. **Given** an archived idea, **When** the user deletes it and confirms, **Then** it disappears from the archive permanently along with its updates.
2. **Given** an idea in the active garden, **When** the user looks for a delete action, **Then** none is offered — archiving is the only way to remove a card from the garden.

---

### Edge Cases

- Archiving an idea that is already archived, or unarchiving one that is already active, is harmless and leaves the idea in the requested state.
- An archived idea must not be reachable by any mutation, including ones aimed at a single timeline entry rather than the idea itself.
- Deleting an archived idea removes its updates too; no orphaned timeline entries remain.
- An archived idea's stage must not drift. Nothing in the system may recompute, raise, or lower it while it is archived.

## Requirements *(mandatory)*

### Functional Requirements

**Archiving**

- **FR-001**: System MUST let a user archive an idea from the active garden.
- **FR-002**: Archiving MUST be reversible and MUST NOT alter the idea's title, description, species, stage, or update history.
- **FR-003**: Archiving MUST NOT change the idea's last-modified timestamp. Archiving is not a modification of the idea's content, and the "last watered" information shown to the user must survive a round trip through the archive.
- **FR-004**: System MUST record when an idea was archived, so the archive can be ordered most-recently-archived first.
- **FR-005**: Archiving an already-archived idea MUST succeed without changing anything.

**Frozen semantics**

- **FR-006**: While an idea is archived, System MUST reject every attempt to modify it or anything belonging to it: editing its title or description, adding a watering, and editing or deleting any of its timeline entries.
- **FR-007**: A rejected mutation MUST fail with a distinguishable error the client can recognise and explain to the user, not a generic failure and not a silent no-op.
- **FR-008**: System MUST still allow an archived idea and its updates to be read.
- **FR-009**: System MUST allow an archived idea to be unarchived or permanently deleted. These are the only two state changes an archived idea accepts.

**Separation from the garden**

- **FR-010**: An archived idea MUST NOT appear in the active garden, and MUST NOT be counted in the garden's idea count.
- **FR-011**: The separation MUST hold across every path that lists or counts active ideas, and MUST continue to hold after unrelated mutations elsewhere in the system.
- **FR-012**: Conversely, an active idea MUST NOT appear in the archive.

**The archive page**

- **FR-013**: System MUST provide a dedicated page for archived ideas at its own route (proposed: `/app/archive`), reachable from the garden and offering a way back.
- **FR-014**: The archive page MUST list archived ideas showing, at minimum, each idea's title and the stage it was frozen at.
- **FR-015**: The archive page MUST show an empty state when nothing is archived, distinct in wording from the empty-garden state.
- **FR-016**: Opening an archived idea MUST present its title, description, plant at its frozen stage, and full timeline, with every mutating affordance absent — not merely disabled or hidden behind an error.

**Unarchive and delete**

- **FR-017**: System MUST let a user unarchive an idea from the archive, returning it to the garden with stage and history intact and immediately waterable.
- **FR-018**: System MUST let a user permanently delete an archived idea, behind the existing destructive-action confirmation, removing its timeline entries with it.
- **FR-019**: System MUST remove permanent deletion from the active garden. Archiving replaces it as the only way to clear a card from the grid.

### Key Entities

- **Idea**: Gains an archive marker — absent for an active idea, and carrying the moment of archiving for an archived one. Every other attribute keeps the meaning it has today. The marker is the single source of truth for whether an idea is active or archived; no second field, flag, or derived column duplicates it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Archiving an idea removes it from the garden and decrements the count within 1 second on a local-machine setup, and the change survives a page reload.
- **SC-002**: Zero archived ideas appear in the garden, and zero active ideas appear in the archive, across every listing in the app.
- **SC-003**: 100% of mutation attempts against an archived idea — title edit, description edit, watering, timeline-entry edit, timeline-entry delete — are rejected, and the idea is byte-for-byte unchanged afterwards.
- **SC-004**: An idea archived at stage N and later unarchived is at stage N, with the same number of timeline entries it had before, and accepts a watering that takes it to stage N+1 (or stays at 16).
- **SC-005**: A user can archive an idea, find it in the archive, and restore it without consulting documentation.
- **SC-006**: Permanently deleting an archived idea leaves no trace of it or its updates after a reload.

## Assumptions

- The product is single-user on one laptop. No concurrency, auth, or rate limiting is in scope; two clients racing to archive the same idea is not a case this spec covers.
- The existing confirmation dialog used for destructive actions is reused for permanent deletion rather than replaced.
- Archived ideas do not need their own sort, search, or filter controls. The archive is expected to stay small enough to read at a glance; if it does not, that is a separate feature.
- Bulk archiving and bulk restoring are not needed. One idea at a time is sufficient.
- The archive is not a recycle bin with automatic expiry. Nothing leaves the archive without the user asking.

## Out of Scope

- Wilting (stages decreasing automatically due to neglect). Deferred per PRD §2.7.
- Sidebar filters, favorites, "Today's Focus", and sort options. Deferred per PRD §2.7.
- Undo for archiving. Unarchiving already covers the recovery path.
- Any change to how stage is derived from waterings for active ideas.
