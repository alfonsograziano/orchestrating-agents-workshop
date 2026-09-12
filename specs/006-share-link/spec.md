# Feature Specification: Read-Only Share Link

**Feature Branch**: `006-share-link`
**Created**: 2026-09-12
**Status**: Draft
**Input**: User description: "Let me create a link to one idea that someone else can open and read, without letting them change anything — and let me revoke it."

> **Parallel execution**: this feature is built at the same time as `005-tags` and `007-backup-json` by separate agents in separate worktrees. Read **File Ownership** below before writing anything. Staying inside your boundary is a hard requirement of this task, not a stylistic preference.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share one idea (Priority: P1)

A user wants to show someone an idea and its growth history. From the idea's card they create a share link, copy it, and send it. The recipient opens the link and sees the idea, its plant, and its full timeline — with no way to edit, water, or reach any other idea.

**Independent Test**: Create a share link for one idea, open it in a context with no application state, confirm the idea and its timeline render and that no mutating control is present.

**Acceptance Scenarios**:

1. **Given** an idea with four updates, **When** the user creates a share link, **Then** a link is returned and shown in a form the user can copy.
2. **Given** a valid share link, **When** anyone opens it, **Then** the idea's title, description, plant at its current stage, and full timeline render read-only.
3. **Given** a share link is open, **When** the viewer looks for a way to edit, water, or delete, **Then** none exists.
4. **Given** an idea is shared twice, **When** the user creates the second link, **Then** the same link is returned rather than a second one accumulating.

---

### User Story 2 - Revoke (Priority: P2)

The user changes their mind. They revoke the link, and it stops working immediately for everyone holding it.

**Independent Test**: Create a link, confirm it loads, revoke it, confirm the same URL now reports that the link is no longer valid.

**Acceptance Scenarios**:

1. **Given** a live share link, **When** the user revokes it, **Then** opening it afterwards shows a clear "this link is no longer available" state rather than an error page or a blank screen.
2. **Given** a revoked idea, **When** the user shares it again, **Then** a new link is issued and the old one stays dead.
3. **Given** an idea has never been shared, **When** the user opens its share control, **Then** it offers to create a link rather than showing an empty one.

---

### Edge Cases

- A token that does not exist, is malformed, or is an empty string must produce the same "not available" outcome — no distinction a guesser could learn from.
- Deleting an idea must invalidate any share link pointing at it.
- The public response must carry only what a reader needs. Anything a viewer could use to reach the authenticated endpoints does not belong in it.
- A viewer of a shared idea must not be able to reach any other idea from it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a user mint a share link for a single idea.
- **FR-002**: Minting a link for an already-shared idea MUST return the existing link, not create another.
- **FR-003**: The token in the link MUST be generated from a cryptographically secure source and MUST be long enough that guessing one is not practical.
- **FR-004**: System MUST serve a share link's idea and its updates without requiring any credential.
- **FR-005**: The public response MUST expose only what a reader needs: the idea's title, description, species, stage, timestamps, and its updates' notes, stages and timestamps.
- **FR-006**: The public response MUST NOT expose the idea's internal identifier, and MUST NOT provide any means of reaching another idea.
- **FR-007**: The public endpoint MUST be read-only. No mutating operation may be reachable through it.
- **FR-008**: System MUST let the owner revoke a share link, after which it MUST stop resolving.
- **FR-009**: Re-sharing a previously revoked idea MUST mint a fresh token; the revoked one MUST stay dead.
- **FR-010**: An unknown, malformed, revoked, or expired token MUST produce one indistinguishable outcome, so a caller learns nothing about which tokens exist.
- **FR-011**: Deleting an idea MUST leave no share link that still resolves to it.
- **FR-012**: The share state of an idea MUST NOT affect its stage, history, or last-modified timestamp.

### Key Entities

- **ShareToken**: An opaque secret pointing at exactly one idea, carrying when it was created and whether it is still live.

## File Ownership *(parallel-execution constraint)*

**You own these. Create or edit only these files:**

```
packages/shared/src/share.schema.ts           (new)
apps/server/src/routes/share.ts               (new — routes + this feature's table DDL)
apps/server/src/routes/share.test.ts          (new)
apps/web/src/api/share.ts                     (new)
apps/web/src/pages/SharedIdea.tsx             (new — the public read-only page)
apps/web/src/components/ShareDialog.tsx       (new)
apps/web/src/components/ShareDialog.test.tsx  (new)
apps/web/src/components/IdeaCard.tsx          (existing — yours alone; the share control mounts here)
apps/web/src/main.tsx                         (existing — yours alone; add the public route)
```

**Do not touch anything else.** In particular, do not edit `apps/server/src/db.ts`, `apps/server/src/app.ts`, `packages/shared/src/index.ts`, `apps/web/src/components/IdeaDetailModal.tsx`, `apps/web/src/components/Header.tsx`, `apps/web/src/App.tsx`, or `apps/web/src/api/ideas.ts` — other agents own or share those. If you believe you need one of them, stop and say so rather than editing it.

**Two conventions that keep you inside the boundary:**

- Import schemas by subpath — `@idea-garden/shared/share.schema` — not through the package barrel.
- Create your table from inside your own route module using the `raw` handle on the database object, with `CREATE TABLE IF NOT EXISTS`. Do not add DDL to the shared schema constant.

## Success Criteria *(mandatory)*

- **SC-001**: A user can mint a link and load it in a fresh browser profile in under 30 seconds.
- **SC-002**: The public payload contains zero fields beyond those listed in FR-005, verified by an explicit test rather than by inspection.
- **SC-003**: Every mutating operation attempted against the public route fails.
- **SC-004**: A revoked token stops resolving immediately, and is indistinguishable from a token that never existed.
- **SC-005**: Deleting a shared idea leaves no resolvable link.

## Assumptions

- The app has no authentication, so "the owner" is whoever is using the local app. The security boundary here is between the local user and a link recipient, not between accounts.
- Links do not expire on a timer. Revocation is manual.
- One link per idea is enough; per-recipient links are not needed.
- The public page reuses the existing plant and timeline presentation. It does not need its own visual language.

## Out of Scope

- Sharing the whole garden, or more than one idea per link.
- Letting a recipient comment, react, or water.
- Password-protected or expiring links.
- Any change to how ideas are listed or rendered inside the app.
