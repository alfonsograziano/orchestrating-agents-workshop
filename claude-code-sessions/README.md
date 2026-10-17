# Claude Code sessions

This folder holds Claude Code sessions recorded during the workshop, plus two small scripts to move a session from one machine to another. Clone the repo, import a session, and you can scroll through it or keep talking to it in your own Claude Code.

Each session is a `.tar.gz` bundle in `chats/`. The scripts are in `scripts/`. They need Node.js 22 or newer and nothing else.

## What is in `chats/`

There are two demos, two sessions each.

**Handoff.** The first session builds part of a feature and then writes a `HANDOFF.md`. The second one starts with no memory, reads that file, and carries on.

**Adversarial review.** The first session implements the archive ideas spec. The second one is a fresh session told to act as a hostile reviewer and find real defects in that diff.

| Bundle | Title in Claude Code |
|---|---|
| `handoff-pt1-wilting-feature.tar.gz` | HANDOFF pt.1 - Wilting feature for Idea Garden |
| `handoff-pt2-handoff-continuation.tar.gz` | HANDOFF pt.2 - HANDOFF.md continuation |
| `HANDOFF.md` | The file pt.1 wrote, exactly as pt.2 read it |
| `adversarial-pt1-archive-ideas-spec.tar.gz` | Adversarial review pt.1 - Archive ideas spec |
| `adversarial-pt2-archive-ideas-spec-review.tar.gz` | Adversarial review pt.2 - Archive ideas spec review |

## Import a session (attendees)

Run this from the root of the cloned repo, once per bundle you want:

```bash
node claude-code-sessions/scripts/import-session.mjs claude-code-sessions/chats/handoff-pt1-wilting-feature.tar.gz
```

Or import all of them at once:

```bash
for f in claude-code-sessions/chats/*.tar.gz; do node claude-code-sessions/scripts/import-session.mjs "$f"; done
```

The script points the session at the folder you are in, gives it a fresh id so it cannot clash with your own sessions, and puts it where Claude Code looks for it. Then, still in the repo root:

```bash
claude --resume
```

Pick the session from the list. You can read it and keep going from where it stopped.

Useful flags:

- `--dir <path>` imports the session for another folder instead of the current one.
- `--title "Demo 1"` sets the name shown in the Claude desktop app.
- `--no-ui` imports for the CLI only and does not touch the desktop app.
- `--keep-id` keeps the original session id instead of making a new one.

**Using the Claude desktop app?** The import also writes the small record the app needs to list the session in its sidebar. The app reads that list only when it starts, so quit it fully and reopen it after the import. If you have never opened a session in the desktop app on this machine, the script imports for the CLI only and tells you so.

## Export a session (speaker)

```bash
node claude-code-sessions/scripts/export-session.mjs <session-id> --out claude-code-sessions/chats --name demo-01 --title "Demo 1" --strip-context --rewrite-all-paths
```

It finds the session under `~/.claude/projects/`, swaps your working directory for a placeholder, packs any large tool outputs, copies the desktop app title if there is one, and writes `demo-01.tar.gz`.

`--title` renames the session for both the CLI picker and the desktop app.

`--strip-context` removes the hidden context Claude Code adds at the start of every session: your email, your other working folders, and the full list of skills and plugins you have installed. The model never needs it to replay the session, and it should not go into a public repo. Always use it for bundles you commit here.

To find a session id, run `claude --resume` and look at the picker, or list `~/.claude/projects/<encoded-folder>/`. The `.jsonl` file names are the ids.

Add `--rewrite-all-paths` to also replace your local path inside the message text, not only in the `cwd` field. It reads better on someone else's screen, but it edits message content, so check the result.

## Things to know

- **Read a session before you commit it.** A transcript holds every file Claude read, every command it ran and every tool result, plus your absolute paths. Check it for secrets first.
- **Run the import from the right folder.** A session only shows up in `claude --resume` when your terminal is in the folder it was imported for. The default is the folder you run the script from, so run it from the repo root.
- **The code is not in the bundle.** The session talks about files in this repo. Reading it works on any branch. To keep working from where a session stopped, check out the code it was recorded on. For the handoff demo, the `live-demo-handoff` branch holds the state after pt.2. For the adversarial review demo, use the `live-demo-adversarial-review` branch.
- **macOS `/tmp` is really `/private/tmp`.** The import script resolves this for you.
- **Removing an import.** Delete the `.jsonl` file the script printed. If it also wrote a desktop app record, delete that `local_<uuid>.json` file too, or the app shows a broken entry.
- **App internals, not a public API.** The desktop app record format can change with an update. The CLI part is just a file copy and is much more stable.
