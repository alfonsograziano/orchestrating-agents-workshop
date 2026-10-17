#!/usr/bin/env node
// Export a Claude Code session into a portable .tar.gz bundle.
// Usage: node export-session.mjs <session-id|/path/to/session.jsonl> [--out DIR] [--rewrite-all-paths] [--name NAME] [--title TITLE] [--strip-context]

import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, basename, dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const PROJECTS = join(homedir(), '.claude', 'projects')
const PLACEHOLDER = '__CLAUDE_DEMO_CWD__'

// The desktop app does not read ~/.claude/projects. It keeps its own record per session,
// a small JSON file holding the title and a "cliSessionId" pointing at the transcript.
// We copy the title out of it so the import can rebuild that record and the session
// shows up in the app sidebar, not only in the CLI `--resume` picker.
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

function findAppRecord(dir, cliSessionId) {
  if (!dir) return null
  for (const name of readdirSync(dir)) {
    if (!name.startsWith('local_') || !name.endsWith('.json')) continue
    let raw
    try { raw = readFileSync(join(dir, name), 'utf8') } catch { continue }
    if (!raw.includes(cliSessionId)) continue
    try {
      const rec = JSON.parse(raw)
      if (rec.cliSessionId === cliSessionId) return rec
    } catch {}
  }
  return null
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: process.cwd() },
    name: { type: 'string' },
    title: { type: 'string' },
    'strip-context': { type: 'boolean', default: false },
    'rewrite-all-paths': { type: 'boolean', default: false },
  },
})

const target = positionals[0]
if (!target) {
  console.error('usage: export-session.mjs <session-id|/path/to/session.jsonl> [--out DIR] [--name NAME] [--title TITLE] [--strip-context] [--rewrite-all-paths]')
  process.exit(1)
}

function findSession(idOrPath) {
  if (idOrPath.endsWith('.jsonl') && existsSync(idOrPath)) return resolve(idOrPath)
  for (const proj of readdirSync(PROJECTS)) {
    const candidate = join(PROJECTS, proj, `${idOrPath}.jsonl`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

const jsonlPath = findSession(target)
if (!jsonlPath) {
  console.error(`No session file found for "${target}".`)
  console.error('Tip: session ids are the .jsonl filenames under ~/.claude/projects/<encoded-cwd>/')
  process.exit(1)
}

const sessionId = basename(jsonlPath, '.jsonl')
const lines = readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean)

// Find the original cwd from the first record that carries one.
let originalCwd = null
for (const line of lines) {
  try {
    const rec = JSON.parse(line)
    if (rec.cwd) { originalCwd = rec.cwd; break }
  } catch {}
}
if (!originalCwd) {
  console.error('Could not find a "cwd" field in this session. Aborting.')
  process.exit(1)
}

// Claude Code injects hidden context at the start of a session: your email, your other
// working folders, and the full list of every skill and plugin you have installed. None of it
// is needed to read or resume the session, and none of it belongs in a public repo.
// Blank the fields in place, never drop the record, so the parentUuid chain stays intact.
// Each record also keeps a "rendered" copy of the text the model saw, so clean both.
function stripContext(rec) {
  const a = rec.type === 'attachment' ? rec.attachment : null
  if (!a) return false
  const render = (fn) => { for (const r of rec.rendered ?? []) if (typeof r.content === 'string') r.content = fn(r.content) }
  if (a.type === 'skill_listing') {
    a.content = ''; a.names = []; a.skillCount = 0
    render(() => '<system-reminder>\n(Skill list removed from this shared transcript.)\n</system-reminder>')
    return true
  }
  if (a.type === 'session_context' && a.context?.userEmail) {
    delete a.context.userEmail
    render((t) => t.replace(/# userEmail\n[^\n]*\n/, ''))
    return true
  }
  if (a.type === 'environment' && a.snapshot?.additionalWorkingDirectories?.length) {
    a.snapshot.additionalWorkingDirectories = []
    render((t) => t.replace(/ *- Additional working directories:\n(?: {2,}- [^\n]*\n)+/, ''))
    return true
  }
  return false
}

const out = []
let rewritten = 0
let stripped = 0
for (const line of lines) {
  let rec
  try { rec = JSON.parse(line) } catch { out.push(line); continue }
  if (rec.cwd === originalCwd) { rec.cwd = PLACEHOLDER; rewritten++ }
  // The CLI picker reads the title from these records, the desktop app from its own record.
  if (values.title && rec.type === 'custom-title') rec.customTitle = values.title
  if (values['strip-context'] && stripContext(rec)) stripped++
  let text = JSON.stringify(rec)
  if (values['rewrite-all-paths']) {
    text = text.split(JSON.stringify(originalCwd).slice(1, -1)).join(PLACEHOLDER)
  }
  out.push(text)
}

const bundleName = values.name || `session-${sessionId.slice(0, 8)}`
const stage = join(values.out, `.${bundleName}.stage`)
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })

writeFileSync(join(stage, 'session.jsonl'), out.join('\n') + '\n')

// Large tool outputs are offloaded to a sibling directory named after the session id.
const sidecar = join(dirname(jsonlPath), sessionId)
let sidecarFiles = 0
if (existsSync(sidecar) && statSync(sidecar).isDirectory()) {
  cpSync(sidecar, join(stage, 'sidecar'), { recursive: true })
  sidecarFiles = execFileSync('find', [join(stage, 'sidecar'), '-type', 'f']).toString().split('\n').filter(Boolean).length
}

const appRecord = findAppRecord(findAppRecordDir(), sessionId)
const ui = appRecord || values.title
  ? {
      title: values.title ?? appRecord?.title ?? null,
      model: appRecord?.model ?? null,
      effort: appRecord?.effort ?? null,
      permissionMode: appRecord?.permissionMode ?? null,
    }
  : null

writeFileSync(join(stage, 'manifest.json'), JSON.stringify({
  format: 'claude-code-session-bundle/2',
  exportedAt: new Date().toISOString(),
  sourceSessionId: sessionId,
  originalCwd,
  placeholder: PLACEHOLDER,
  records: lines.length,
  rewroteAllPaths: values['rewrite-all-paths'],
  strippedContext: values['strip-context'],
  hasSidecar: sidecarFiles > 0,
  ui,
}, null, 2) + '\n')

const tarball = join(values.out, `${bundleName}.tar.gz`)
execFileSync('tar', ['-czf', tarball, '-C', stage, '.'])
rmSync(stage, { recursive: true, force: true })

console.log(`Exported ${sessionId}`)
console.log(`  records:     ${lines.length}`)
console.log(`  cwd rewrites: ${rewritten} (${originalCwd} -> ${PLACEHOLDER})`)
console.log(`  sidecar files: ${sidecarFiles}`)
if (values['strip-context']) console.log(`  context records stripped: ${stripped}`)
console.log(`  desktop title: ${ui?.title ? `"${ui.title}"` : 'not found (CLI-only bundle)'}`)
console.log(`  bundle:      ${tarball}`)
console.log('')
console.log('Read the transcript before you share it. It holds every file you opened, every command you ran, and every tool result.')
