# Orchestrating Coding Agents — Demo Repo

This is the codebase used for the live demos in **Orchestrating coding agents**, an O'Reilly live course by [Alfonso Graziano](https://ainativesoftware.engineering).

> *Patterns for running more than one agent without losing control. Scratchpads, critics, worktrees, subagents, and orchestration written as code.*

The repo is not the subject of the course — it is the **workbench**. Every pattern in the course needs a real codebase with real files, real tests and real diffs to act on, and this is it. Nothing here is a toy fixture: the app builds, the tests run, and the agents have somewhere to make genuine mistakes.

---

## What's In Here

**Idea Garden** — a small web app where every idea you capture grows like a plant. Capture an idea, it appears as a card with a seedling. Come back and "water" it with an update, and the plant advances a stage. It is already **fully built**: the garden grid, the detail modal, the growth timeline and the animated plant viewport all work.

| Layer | Stack |
|---|---|
| **Web** | Vite + React + Tailwind, Three.js plant viewport, Vitest + RTL unit tests, Playwright e2e |
| **Server** | Fastify on Node 22 native type stripping (no build step), SQLite via `better-sqlite3` |
| **Shared** | Zod schemas as the single source of truth for API request/response shapes |

It is deliberately small enough to hold in your head, and large enough that an agent has to actually read it.

---

## Repo Shape

The repo is a **single commit on `master`** — one clean baseline, no branches, no tags.

That is intentional. The demos create branches, worktrees and commits as they run. Starting from one known commit means the repo can be reset to a pristine state in seconds between runs, and that a demo that goes sideways on stage costs nothing.

```bash
git log --oneline        # exactly one commit
```

---

## Running the App

```bash
npm install          # install all workspaces
npm run dev          # server on :3000, frontend on :5173
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm test             # all Vitest suites across workspaces
npm run typecheck    # types across workspaces
```

These two matter more than usual here. Several patterns in the course — the `/goal` loop, the Ralph loop, the dark factory — rely on **checks a machine can run** as the brake on an autonomous agent. `npm test` is that brake.

**Reset the database** to a clean state at any point:
```bash
rm -f data/garden.db   # the server recreates the schema on next boot
```

> Requires Node 22.6+ (`node --version`). The server runs TypeScript directly via `--experimental-strip-types`.

---

## The Demos

Three sections of the course have a **Live demo** slide — § 02, § 03 and § 04. Each one runs against this repo. § 05's walkthrough uses it too.

### § 02 — One agent, bigger jobs: the handoff

A session works until it starts to drift, writes its state to `HANDOFF.md`, and a **fresh window** picks the work up from that file alone. The point is that the scratchpad is a file you can open, edit and commit — unlike a compaction summary, which the tool writes in the dark and you can never see.

Good jobs to hand off in this codebase: anything that spans both apps and the shared schema package, so the first session has genuinely accumulated context worth preserving.

### § 03 — Two agents, one loop: the adversarial review

One agent writes a change. A **second agent, in a fresh window and ideally a different model**, reads the diff cold and attacks it. You filter the findings — some real, some nitpicks, some false alarms — and only the real ones go back to the first agent.

Produce a diff worth attacking first. Anything touching validation, the update/stage transition, or the SQLite writes gives the reviewer real material.

```bash
git diff                      # uncommitted work the agent just produced
git diff master...<branch>    # or, if the agent worked on its own branch
```

### § 04 — Agents in parallel: worktrees

Three agents, three worktrees, three branches, one repo — nobody touching anybody else's files.

```bash
git worktree add ../bump-dep   -b bump-dep
git worktree add ../fix-login  -b fix-login
git worktree add ../export-csv -b export-csv
```

Two things bite in this repo specifically, and both are worth showing rather than hiding:

- **Ignored files do not come along.** `node_modules` and `data/` are ignored, so a fresh worktree needs its own `npm install` before anything runs.
- **Shared services stay shared, and the failure is silent.** Run `npm run dev` in a second worktree and Vite quietly falls back to port 5174 — but its `/api` proxy target is hardcoded to `localhost:3000`, so that frontend talks to the *first* worktree's server and its database. Everything looks fine and the data goes to the wrong place. This is the slide's "you wire that isolation yourself" point, with teeth.

The practical rule: **one dev server at a time.** Parallel agents in other worktrees should be running `npm test` and `npm run typecheck`, which need no ports. If you genuinely need two servers up, the server takes `PORT`, and `apps/web/vite.config.ts` needs its proxy target changed to match.

### § 05 — Orchestration as code *(walkthrough, not a live demo slide)*

The workflow-as-code pattern needs an agent with a headless mode and a repo to point it at. The task list and specs already in `specs/` give a script something concrete to iterate over.

---

## Resetting Between Demos

After a demo that created branches, worktrees or commits:

```bash
git worktree list                          # see what's left
git worktree remove ../<folder> --force    # for each one
git checkout master
git reset --hard origin/master             # back to the single baseline commit
git clean -fd                              # drop untracked files (HANDOFF.md, scratch dirs)
rm -f data/garden.db                        # fresh database
```

`git clean -fd` will delete any untracked file you have not committed — including notes you may want to keep. Check `git status` first.

---

## What Else Is In The Repo

### `specs/` and `.specify/memory/`

Real SDD artifacts from an earlier build of this app: `spec.md`, `plan.md`, `tasks.md`, a project constitution, a PRD, and a design system.

They are not homework. They are here as a worked example of **§ 02's "a scratchpad a whole team can share"** — the steps do not message each other, each one writes what it produced and the next reads it back out of the same files. They also give any agent working in this repo real context to read, which makes its output markedly better than working from the code alone.

`CLAUDE.md` points at them, so most agents will pick them up automatically.

### Playwright end-to-end tests

[Playwright](https://playwright.dev/) e2e specs live in `apps/web/e2e/`:

```bash
npm run test:e2e --workspace=apps/web
```

It starts its own server and frontend on **3030 / 5273** against a separate `data/e2e-garden.db`, so it does not collide with a dev server you already have running. Override with `E2E_SERVER_PORT` / `E2E_WEB_PORT` if you need several at once.

This is the strongest brake available to an autonomous loop here — a check that exercises the real UI and that an agent cannot talk its way past. Adding a Playwright **MCP server** on top (so an agent can drive the browser interactively and screenshot what it built) is a natural extension, but note it is **not configured in this repo** — you would wire it up in your own agent config.

### Agent skills

| Skill | What it does |
|---|---|
| `threejs-*` | Geometry, shaders, lighting, animation, post-processing, loaders and interaction — for work on the plant viewport |
| `frontend-design` | Layout, spacing, component structure, accessibility and visual polish |

Pinned in `skills-lock.json`. Agents invoke them when they recognise a matching task.

---

## Troubleshooting

**`npm run dev` fails**
- Check Node version: `node --version` — must be 22.6+
- Run `npm install` from the repo root if `node_modules` is missing or stale
- Ports 3000 and 5173 must be free. A dev server left running in another worktree is the usual culprit.

**A worktree behaves differently from the main checkout**
- It needs its own `npm install` — `node_modules` is ignored and does not follow a worktree
- It has no `data/garden.db` until its server boots once

**The app shows a blank screen or network errors**
- Both server and frontend must be running (`npm run dev` starts both)
- Check the server logs in the terminal — Fastify prints startup errors clearly
- Bad database state: `rm -f data/garden.db` and restart

**An agent has left the repo in a strange state**
- See [Resetting Between Demos](#resetting-between-demos) above

---

*Course materials and slides are distributed through O'Reilly. More on the patterns behind this course at [ainativesoftware.engineering](https://ainativesoftware.engineering).*
