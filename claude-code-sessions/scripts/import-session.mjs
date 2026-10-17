#!/usr/bin/env node
// Import a session bundle produced by export-session.mjs so it shows up in `claude --resume`
// and in the Claude desktop app sidebar.
// Usage: node import-session.mjs <bundle.tar.gz> [--dir TARGET_DIR] [--keep-id] [--title NAME] [--no-ui]

import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, realpathSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

const PROJECTS = join(homedir(), '.claude', 'projects')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string', default: process.cwd() },
    'keep-id': { type: 'boolean', default: false },
    title: { type: 'string' },
    'no-ui': { type: 'boolean', default: false },
  },
})

const bundle = positionals[0]
if (!bundle || !existsSync(bundle)) {
  console.error('usage: import-session.mjs <bundle.tar.gz> [--dir TARGET_DIR] [--keep-id] [--title NAME] [--no-ui]')
  process.exit(1)
}

// The desktop app does not read ~/.claude/projects. It keeps its own record per session,
// a small JSON file holding the title and a "cliSessionId" pointing at the transcript.
// Drop in a transcript without that record and the session exists for the CLI but is
// invisible in the app. So we write the record too.
function appStoreRoots() {
  const home = homedir()
  const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
  const xdg = process.env.XDG_CONFIG_HOME || join(home, '.config')
  return [
    join(home, 'Library', 'Application Support', 'Claude', 'claude-code-sessions'),
    join(appData, 'Claude', 'claude-code-sessions'),
    join(xdg, 'Claude', 'claude-code-sessions'),
  ]
}

// Records live a couple of account-id folders deep, so walk down and take the folder
// that actually holds local_*.json files.
function findAppRecordDir() {
  const found = []
  const walk = (dir, depth) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    if (entries.some((e) => e.isFile() && e.name.startsWith('local_') && e.name.endsWith('.json'))) {
      found.push({ dir, mtime: statSync(dir).mtimeMs })
    }
    if (depth === 0) return
    for (const e of entries) if (e.isDirectory()) walk(join(dir, e.name), depth - 1)
  }
  for (const root of appStoreRoots()) if (existsSync(root)) walk(root, 3)
  found.sort((a, b) => b.mtime - a.mtime)
  return found[0]?.dir ?? null
}

// Model, effort and permission mode are the app's own settings, not part of the transcript.
// Copy them off the newest record that is already there so the imported one matches the
// rest of this machine instead of guessing at values.
function localDefaults(dir) {
  const files = readdirSync(dir)
    .filter((n) => n.startsWith('local_') && n.endsWith('.json'))
    .map((n) => ({ n, mtime: statSync(join(dir, n)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  for (const { n } of files) {
    try {
      const rec = JSON.parse(readFileSync(join(dir, n), 'utf8'))
      if (rec.model) return { model: rec.model, effort: rec.effort, permissionMode: rec.permissionMode }
    } catch {}
  }
  return {}
}

// macOS symlinks /tmp to /private/tmp. Claude Code keys the folder on the real path,
// so resolve symlinks or the session will not show up in --resume.
const targetDir = realpathSync(resolve(values.dir))
const encoded = targetDir.replace(/[/.]/g, '-')
const projectDir = join(PROJECTS, encoded)

const stage = join(tmpdir(), `claude-import-${randomUUID()}`)
mkdirSync(stage, { recursive: true })
execFileSync('tar', ['-xzf', resolve(bundle), '-C', stage])

const manifest = JSON.parse(readFileSync(join(stage, 'manifest.json'), 'utf8'))
const placeholder = manifest.placeholder
const newId = values['keep-id'] ? manifest.sourceSessionId : randomUUID()

const lines = readFileSync(join(stage, 'session.jsonl'), 'utf8').split('\n').filter(Boolean)
const out = lines.map((line) => {
  let text = line.split(placeholder).join(targetDir)
  if (!values['keep-id']) text = text.split(manifest.sourceSessionId).join(newId)
  return text
})

mkdirSync(projectDir, { recursive: true })
const dest = join(projectDir, `${newId}.jsonl`)
writeFileSync(dest, out.join('\n') + '\n')

if (manifest.hasSidecar && existsSync(join(stage, 'sidecar'))) {
  const sidecarDest = join(projectDir, newId)
  rmSync(sidecarDest, { recursive: true, force: true })
  cpSync(join(stage, 'sidecar'), sidecarDest, { recursive: true })
}

rmSync(stage, { recursive: true, force: true })

console.log('Imported.')
console.log(`  session id: ${newId}`)
console.log(`  project:    ${projectDir}`)

let uiNote = null
if (values['no-ui']) {
  uiNote = 'skipped (--no-ui). CLI only.'
} else {
  const recordDir = findAppRecordDir()
  if (!recordDir) {
    uiNote = 'no desktop app records found, so the CLI picker is the only place it shows. Open one session in the app first, then re-run to get a sidebar entry.'
  } else {
    const title = values.title || manifest.ui?.title || `Imported session ${newId.slice(0, 8)}`
    const localId = `local_${randomUUID()}`
    const now = Date.now()
    const record = {
      sessionId: localId,
      cliSessionId: newId,
      cwd: targetDir,
      originCwd: targetDir,
      title,
      titleSource: 'auto',
      createdAt: now,
      lastActivityAt: now,
      lastFocusedAt: now,
      isArchived: false,
      ...localDefaults(recordDir),
    }
    writeFileSync(join(recordDir, `${localId}.json`), JSON.stringify(record, null, 2) + '\n')
    uiNote = `"${title}" (${localId})`
    console.log(`  app record: ${join(recordDir, `${localId}.json`)}`)
  }
}

console.log('')
console.log('Now run:')
console.log(`  cd ${targetDir} && claude --resume ${newId}`)
console.log('Or just `claude --resume` in that folder and pick it from the list.')
console.log('')
console.log(`Desktop app: ${uiNote}`)
if (uiNote && !values['no-ui'] && uiNote.startsWith('"')) {
  console.log('Restart the Claude desktop app to see it in the sidebar. The app reads its session list once at startup, so it will not appear until you quit and reopen it.')
}
