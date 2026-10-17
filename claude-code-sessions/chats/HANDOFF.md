# Handoff — Wilting (server-side)

Branch: `master`. Working tree has uncommitted changes (nothing committed yet).

## Goal

Add **wilting** to Idea Garden: an idea that has not been watered in a while
loses ground, sitting one growth stage below where its waterings alone would
put it. Product intent is gentle pressure to return to neglected ideas — an
idea you abandoned should look abandoned.

This session was scoped to **server-side only**: `packages/shared` (the Zod API
contract) and `apps/server` (db, routes, tests). `apps/web` was explicitly
out of scope and was **not touched**. A separate session builds the UI from the
API this leaves behind.

The API must let a client determine, for any idea, (a) whether it is currently
wilted and (b) how long since it was last watered — on both the list and the
detail endpoint.

## Decisions

### 1. Wilting is derived at read time, never stored

Two facts about the pre-existing code make a stored wilt state impossible:

- **`stage` is a derived column, not a counter.** `recomputeIdeaStage`
  (`apps/server/src/db.ts`) rewrites it as
  `COALESCE(MAX(idea_updates.stage_after), 1)` inside *every* mutation —
  including a note edit or an update deletion. A wilt penalty written into the
  column would be erased by the next write.
- **Nothing writes to the database when time passes.** Wilting is a function of
  elapsed time; a stored flag or decremented column would be stale the instant
  the clock crossed the threshold, and no request or job exists to fix it.

So `stage` keeps its exact existing meaning (where the waterings alone put the
idea), and the wilting view is computed per read in
`apps/server/src/wilting.ts`. A useful consequence: "does watering restore what
was lost?" needs no rule — it restores fully and instantly, because nothing was
ever persisted as lost.

### 2. `last_watered_at` comes from `idea_updates`, not from `ideas.updated_at`

`ideas.updated_at` means **"last touched"**, not "last watered":
`updateIdeaMeta` bumps it on a title edit, and `recomputeIdeaStage` bumps it on
every mutation. Using it would let renaming an abandoned idea silently un-wilt
it. `last_watered_at` is derived as `MAX(idea_updates.created_at)` via a
correlated subquery that rides the existing `idx_updates_idea_id_created`
index, so deleting the newest watering re-derives it for free. No denormalised
column was added. There is a regression test for the rename case specifically.

### 3. New fields go on an *extension* of `IdeaSchema`, not on `IdeaSchema`

`GardenIdeaSchema = IdeaSchema.extend({ last_watered_at, ms_since_watered,
wilted, effective_stage })`, plus `GardenIdeaListSchema`,
`GardenIdeaDetailResponseSchema`, `GardenMutationResponseSchema`.

Reason: `apps/web` parses responses with `IdeaListSchema`,
`IdeaDetailResponseSchema` and `MutationResponseSchema`, and its test fixtures
are built **without** the new fields. Making the fields required on those base
schemas breaks web tests that were not allowed to be touched or weakened. With
the extension, the server sends the richer payload and web's non-strict parse
strips the extra keys, so web is unaffected today.

**This is transitional duplication and should not be permanent** — see *Next*.

### 4. Mutation responses carry the wilting view too

Not just list + detail. The constitution (Principle I) requires the client to
use server-returned values rather than local guesses, so watering has to return
the refreshed wilting state or the client cannot tell that an idea un-wilted.

### 5. Determinism: the clock is injected

`buildApp({ now })` takes a `() => number`, defaulting to `Date.now`. The ideas
routes use it for every timestamp they write *and* for the wilting derivation,
so a test can water at T and read at T + 8 days.
`db.runUpdateMutation` was deliberately left calling `Date.now()` internally —
it only sets `ideas.updated_at`, which wilting must not read anyway (decision 2).

### 6. Product defaults chosen where the brief was silent

| Question | Choice | Reason |
|---|---|---|
| How long is "a while"? | **7 days** (`WILT_AFTER_MS`), wilted at `>= 7d` exactly | A normal week of neglect is forgiven; longer reads as walking away |
| Never-watered ideas? | **They wilt**, measured from `created_at` | A seed nobody came back to is the most abandoned thing in the garden |
| Bottom of the stage range? | **Floor at 1** — `wilted: true` with `effective_stage: 1` | Badge still fires; there is no ground left to lose |
| Does neglect compound? | **No** — one stage lost, ever | The brief says "one growth stage below" |
| Does watering restore? | **Yes, fully and immediately**, plus the stage the watering itself earns | Falls out of decision 1 |

## Done

Working and verified:

- `packages/shared/src/ideas.schema.ts` — `WiltingFieldsSchema`,
  `GardenIdeaSchema`, `GardenIdeaListSchema`,
  `GardenIdeaDetailResponseSchema`, `GardenMutationResponseSchema`, with the
  reasoning recorded in comments. Base schemas unchanged.
- `apps/server/src/wilting.ts` (new) — `WILT_AFTER_MS` and
  `toGardenIdea(row, now)`, a pure function of (row, now).
- `apps/server/src/db.ts` — `IdeaReadRow` type; `selectAllIdeas` and
  `selectIdeaById` now derive `last_watered_at`. No schema/DDL change, no new
  column, no migration.
- `apps/server/src/app.ts` — injectable `now` option.
- `apps/server/src/routes/ideas.ts` — a single `view()` helper decorates every
  idea leaving the file, so list, detail and all four mutation responses answer
  wilting identically. Route response schemas switched to the `Garden*` ones.
- Tests: **16 new** contract tests in `apps/server/src/routes/ideas.test.ts`
  (fresh idea, both threshold boundaries, one-stage drop, stored `stage`
  unchanged, floor at 1, stage-16 → effective 15, restore on watering,
  re-wilt, title-edit-does-not-water, delete-newest-watering re-derivation,
  newest-not-first, list/detail agreement, per-idea independence, base-schema
  back-compat) and **12 new** schema tests in
  `packages/shared/src/ideas.schema.test.ts`.
- No new dependencies. No files in `apps/web` modified.

All green, exit 0: server 74 tests, web 132, shared 69; server typecheck and
repo-wide typecheck clean. No existing test was modified or weakened.

### Tried and rejected

- **Decrementing/storing the wilt in `ideas.stage`** — rejected after reading
  `recomputeIdeaStage`: the next mutation erases it, and nothing writes at all
  when time merely passes. This was analysis, not a failed experiment.
- **Adding the wilting fields directly to `IdeaSchema` / the base response
  schemas** — rejected after confirming by inspection that
  `apps/web/src/api/ideas.ts` `safeParse`s every response with those schemas
  and that the web test fixtures (`buildIdea` in
  `apps/web/src/hooks/useIdeas.test.tsx` and the other five fixture sites) omit
  the new fields, so required fields would fail those parses. Not run to
  failure; rejected before writing.
- **Making the fields optional on `IdeaSchema`** — rejected: it would leave the
  client unable to rely on them, failing the stated requirement.
- **Freezing the clock for the whole existing test suite** — rejected: the
  existing "created_at DESC, id DESC" ordering test relies on real time moving
  between calls (ULIDs generated in the same millisecond do not sort
  deterministically). The wilting suite builds its own app instance with a
  controllable clock instead.

## Next

In order:

1. **UI session** — consume the wilting fields. The API boundary is where this
   session deliberately stopped; no frontend design decisions were made here.
2. **Retire the transitional duplication** once web is on the `Garden*`
   schemas: fold the wilting fields into the base response schemas and delete
   the `Garden*` siblings, updating web fixtures in the same change. Until then
   the two sets must stay in sync.
3. **Fix the mislabelled timestamp in the UI.** `apps/web/src/components/IdeaCard.tsx:99`
   renders `Watered {relativeTime(reference, idea.created_at)}` — it shows the
   *planting* date and calls it watering. `last_watered_at` is the correct
   input and is now available. Pre-existing bug, out of scope this session.
4. **Update the PRD / constitution** (see Open questions).
5. **Run the Playwright e2e suite** (`npm run test:e2e --workspace=apps/web`) —
   it was not run this session.

## Open questions

- **The constitution defers wilting.** `.specify/memory/constitution.md`
  ("Tech Stack & Scope Discipline") lists wilting among PRD §2.7 stretch goals
  and says implementing one "requires a PRD update first, not a 'while I'm
  here' commit". This was raised and the work was requested directly, so it was
  built; the PRD/plan still need updating to match. There is no
  `specs/` folder for wilting — no spec.md, plan.md, data-model.md or contract
  was produced, which departs from the SDD workflow the repo documents for
  `master`.
- **7 days is a guess**, not a product-confirmed number. It is a single
  exported constant (`WILT_AFTER_MS`), easy to change; the boundary tests are
  written relative to it, so they follow automatically.
- **Which stage does the UI render** — `stage` (waterings only) or
  `effective_stage` (wilt-adjusted)? Both are on the wire and the server takes
  no position. Note that `MutationResponse.prev_stage` is the *stored* stage, so
  a growth animation that diffs `prev_stage` against `effective_stage` would
  compare two different quantities.
- **Wilting an unwatered seed is invisible** at the stage level (floor at 1), so
  the `wilted` flag is the only signal for those. Worth confirming that is the
  intended product behaviour.
- **Playwright e2e not run.** `npm test` runs vitest only (`test:e2e` is a
  separate script). Web parses with the base schemas and extra keys are
  stripped, so e2e is expected to be unaffected — unverified.
- **Clock skew between routes and db.** Routes use the injected `now`; 
  `runUpdateMutation` uses real `Date.now()` for `ideas.updated_at`. Harmless
  today (tests drive the clock forward from real now), but a test that set the
  clock to a *far past* value could produce `updated_at > created_at`
  orderings that look odd.

## Key files and commands

Files, most important first:

| File | Why it matters |
|---|---|
| `apps/server/src/wilting.ts` | The whole rule: `WILT_AFTER_MS`, `toGardenIdea(row, now)` |
| `packages/shared/src/ideas.schema.ts` | The API contract; `Garden*` schemas at the bottom |
| `apps/server/src/db.ts` | `IdeaReadRow`; the two selects deriving `last_watered_at`; `recomputeIdeaStage` (why stage cannot hold wilt) |
| `apps/server/src/routes/ideas.ts` | The `view()` helper and the seven endpoints |
| `apps/server/src/routes/ideas.test.ts` | Contract tests; the `describe('wilting (US-wilting)')` block owns the clock |
| `apps/server/src/app.ts` | `buildApp({ now })` injection point |
| `.specify/memory/constitution.md` | Binding rules (tests mandatory, one source of truth for types, no new deps) |
| `.specify/memory/design.md` | Already specifies `colors.wilted` (#B5703A) and a `badge-wilted` chip — the visual contract pre-dates this work |

Commands (all pass as of this handoff):

```bash
npm test --workspace=apps/server
```

```bash
npm run typecheck --workspace=apps/server
```

```bash
npm test
```

```bash
npm run typecheck
```

Run the server (SQLite file at `data/garden.db`, gitignored):

```bash
npm run dev --workspace=apps/server
```

## Notes for whoever picks this up

- **Read `recomputeIdeaStage` before changing anything about stages.** It runs
  on *every* mutation and recomputes `ideas.stage` from the updates table. Most
  intuitions about "just update the stage column" are wrong here.
- **Timestamp names lie.** `ideas.updated_at` = last touched.
  `ideas.created_at` = planted. `idea_updates.created_at` = watered. The only
  source for "last watered" is the updates table.
- **Stage progression rule** (unchanged): unwatered = Level 1, each watering
  takes `MIN(MAX(stage_after) + 1, 16)`; deleting the highest update lowers the
  stage again.
- **Web's parsing is non-strict**, which is what makes the additive server
  change safe. Do not add `.strict()` to the base schemas without updating web
  first.
- Test helpers `plantIdea(app, ...)` and `water(app, id, note)` already take the
  app as a parameter, which is what let the wilting suite run a second app
  instance against the same db with a different clock.
- Existing tests run fast enough that nothing wilts accidentally: real-clock
  tests never cross the 7-day threshold.
