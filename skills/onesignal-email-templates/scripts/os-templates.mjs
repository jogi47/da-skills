#!/usr/bin/env node
// Pull, diff and push OneSignal email templates through the OneSignal REST API.
// Usage and safety rules: ../SKILL.md. Needs Node 21.7+ (util.parseEnv, global fetch), no packages.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseArgs, parseEnv } from 'node:util'

const API = 'https://api.onesignal.com'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const ENV_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const USAGE = `usage:
  os-templates.mjs list  --env <name> --env-file <path>
  os-templates.mjs pull  <ref...> --env <name> --env-file <path>
  os-templates.mjs push  <ref...> --env <name> --env-file <path> [--apply --allow-live]

<ref>   a *_TEMPLATE_ID key, a template UUID, or name:<exact template name>
<name>  a label for the configuration; it does not isolate live templates
Config keys default to ONESIGNAL_APP_ID and ONESIGNAL_API_KEY.
Use --app-id-key and --api-key-key for other env-file key names.
Authentication defaults to Key; --auth-scheme Basic is available for legacy setups.
Files go to tmp/onesignal/<name>/ under the current directory unless --out is given.
push without --apply only prints the diff; nothing is sent.
Every applied update changes a live template and also needs --allow-live.`

function die (msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

const mask = (id) => `${id.slice(0, 8)}…`
const scrub = (s) => String(s).replace(UUID_ANYWHERE, mask)

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: 'string' },
    'env-file': { type: 'string' },
    out: { type: 'string' },
    apply: { type: 'boolean', default: false },
    'allow-live': { type: 'boolean', default: false },
    'app-id-key': { type: 'string', default: 'ONESIGNAL_APP_ID' },
    'api-key-key': { type: 'string', default: 'ONESIGNAL_API_KEY' },
    'auth-scheme': { type: 'string', default: 'Key' },
    help: { type: 'boolean', short: 'h', default: false }
  }
})

const [command, ...refs] = positionals
if (opts.help || !command) {
  console.log(USAGE)
  process.exit(0)
}
if (!ENV_LABEL.test(opts.env ?? '')) die('--env must be a label starting with a letter or digit, using letters, digits, dots, underscores or hyphens')
if (!opts['env-file']) die('--env-file is required: the config of the environment named by --env')
if (!existsSync(opts['env-file'])) die(`env file not found: ${opts['env-file']}`)

// Only the keys this tool needs are read, and no value from the file is ever printed.
const envFile = parseEnv(readFileSync(opts['env-file'], 'utf8'))
const APP_ID = envFile[opts['app-id-key']]
const API_KEY = envFile[opts['api-key-key']]
if (!APP_ID || !UUID.test(APP_ID)) die(`${opts['app-id-key']} is missing from the env file or is not a UUID`)
if (!API_KEY) die(`${opts['api-key-key']} is missing from the env file`)
if (!['Key', 'Basic'].includes(opts['auth-scheme'])) die('--auth-scheme must be Key or Basic')
const AUTH = `${opts['auth-scheme']} ${API_KEY}`

const OUT = resolve(opts.out ?? join(process.cwd(), 'tmp', 'onesignal', opts.env))
mkdirSync(join(OUT, 'backups'), { recursive: true })

const templateKeys = Object.entries(envFile).filter(([k, v]) => k.endsWith('_TEMPLATE_ID') && UUID.test(v || ''))

async function api (method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json; charset=utf-8' },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  if (!res.ok) die(`${method} ${scrub(path.split('?')[0])} -> HTTP ${res.status}; response body omitted to avoid exposing private data`)
  return text ? JSON.parse(text) : {}
}

const getTemplate = (id) => api('GET', `/templates/${id}?app_id=${APP_ID}`)
const bodyOf = (t) => t.content?.email_body ?? t.email_body

// The rest of an email template's settings. The docs do not say whether PATCH keeps fields it is
// not sent, so push sends these back unchanged and checks afterwards that none of them moved.
const EMAIL_SETTINGS = ['email_subject', 'email_preheader', 'email_from_address', 'email_from_name',
  'email_reply_to_address', 'email_bcc', 'disable_email_click_tracking']
const settingsOf = (t) => Object.fromEntries(EMAIL_SETTINGS.map((f) => [f, t.content?.[f] ?? null]))

let templateList
async function listTemplates () {
  if (templateList) return templateList
  templateList = []
  for (let offset = 0; ; offset += 50) {
    const page = await api('GET', `/templates?app_id=${APP_ID}&limit=50&offset=${offset}&channel=email`)
    const templates = page.templates || []
    templateList.push(...templates)
    if (!templates.length || offset + 50 >= (page.total_count ?? 0)) break
  }
  return templateList
}

async function resolveRef (ref) {
  if (ref.startsWith('name:')) {
    const name = ref.slice('name:'.length)
    const matches = (await listTemplates()).filter((t) => t.name === name)
    if (matches.length !== 1) die(`${matches.length} email templates are named "${name}"; need exactly one`)
    return { id: matches[0].id, base: `name-${name.replace(/[^A-Za-z0-9._-]+/g, '_')}` }
  }
  if (UUID.test(ref)) return { id: ref, base: ref }
  if (!/^[A-Za-z_][A-Za-z0-9_]*_TEMPLATE_ID$/.test(ref)) die('reference must be a *_TEMPLATE_ID key, UUID or name:<exact name>')
  const id = envFile[ref]
  if (!id) die(`${ref} is not set in the env file`)
  if (!UUID.test(id)) die(`${ref} does not hold a template UUID`)
  return { id, base: ref }
}

const filesFor = (base) => ({
  orig: join(OUT, `${base}.orig.html`),
  work: join(OUT, `${base}.html`),
  json: join(OUT, `${base}.json`)
})
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')
const backup = (base, t) =>
  writeFileSync(join(OUT, 'backups', `${base}.${stamp()}.json`), JSON.stringify(t, null, 2))

// A cheap guard against a paste that breaks the template: every block tag must be closed.
function liquidProblems (html) {
  const count = (re) => (html.match(re) || []).length
  const problems = []
  for (const [open, close] of [['if', 'endif'], ['unless', 'endunless'], ['for', 'endfor'], ['case', 'endcase']]) {
    const opened = count(new RegExp(`\\{%-?\\s*${open}\\b`, 'g'))
    const closed = count(new RegExp(`\\{%-?\\s*${close}\\s*-?%\\}`, 'g'))
    if (opened !== closed) problems.push(`${opened} {% ${open} %} vs ${closed} {% ${close} %}`)
  }
  return problems
}

async function list () {
  const keyById = new Map(templateKeys.map(([k, v]) => [v.toLowerCase(), k]))
  const rows = await listTemplates()
  console.log(`${opts.env}: ${rows.length} email templates in app ${mask(APP_ID)}`)
  for (const t of rows) {
    const key = keyById.get(t.id.toLowerCase())
    console.log(`  ${mask(t.id)}  ${(t.updated_at || '').slice(0, 10).padEnd(10)}  ${t.name}${key ? `   <- ${key}` : ''}`)
  }
  for (const [k, v] of templateKeys) {
    if (!rows.some((t) => t.id.toLowerCase() === v.toLowerCase())) console.log(`  not in this app: ${k}`)
  }
}

async function pull (ref) {
  const { id, base } = await resolveRef(ref)
  const f = filesFor(base)
  if (existsSync(f.work) && existsSync(f.orig) && readFileSync(f.work, 'utf8') !== readFileSync(f.orig, 'utf8')) {
    die(`${base}: ${f.work} has edits that were never pushed; push it or delete it before pulling again`)
  }
  const t = await getTemplate(id)
  const html = bodyOf(t)
  if (typeof html !== 'string') die(`${base}: the response has no email_body (not an email template?)`)
  backup(base, t)
  writeFileSync(f.json, JSON.stringify(t, null, 2))
  writeFileSync(f.orig, html)
  writeFileSync(f.work, html)
  console.log(`${base}: "${t.name}" ${mask(id)}, updated ${t.updated_at}, ${html.length} chars`)
  console.log(`  content keys: ${Object.keys(t.content || {}).join(', ') || '(none)'}`)
  console.log(`  edit ${f.work}`)
}

async function push (ref) {
  const { id, base } = await resolveRef(ref)
  const f = filesFor(base)
  if (!existsSync(f.orig) || !existsSync(f.work)) die(`${base}: pull it first`)
  const orig = readFileSync(f.orig, 'utf8')
  const next = readFileSync(f.work, 'utf8')
  if (next === orig) {
    console.log(`${base}: no local changes`)
    return
  }
  const problems = liquidProblems(next)
  if (problems.length) die(`${base}: unbalanced Liquid tags: ${problems.join('; ')}`)

  const live = await getTemplate(id)
  if (bodyOf(live) !== orig) die(`${base}: the live template changed after it was pulled; pull again and redo the edit`)

  console.log(`=== ${opts.env} / ${base} / "${live.name}"`)
  const diff = spawnSync('diff', ['-u', '--label', `${base} (live)`, '--label', `${base} (edited)`, f.orig, f.work], { stdio: 'inherit' })
  if (diff.error || ![0, 1].includes(diff.status)) die('could not produce the diff; check that the system diff command is available')

  if (!opts.apply) {
    console.log(`${base}: dry run, nothing sent. Re-run with --apply to update ${opts.env}.`)
    return
  }
  // The environment label does not prove isolation: all remote updates are live.
  if (!opts['allow-live']) die('--apply changes a live template and also needs --allow-live')

  backup(base, live)
  const settings = settingsOf(live)
  await api('PATCH', `/templates/${id}?app_id=${APP_ID}`, {
    name: live.name,
    isEmail: true,
    email_body: next,
    ...Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== null))
  })

  const after = await getTemplate(id)
  const moved = EMAIL_SETTINGS.filter((f) => JSON.stringify(settingsOf(after)[f]) !== JSON.stringify(settings[f]))
  if (moved.length) {
    die(`${base}: the update changed ${moved.join(', ')}; restore them from the pre-push backup in ${join(OUT, 'backups')}`)
  }
  const stored = bodyOf(after)
  if (stored !== next) {
    const squash = (s) => String(s).replace(/\s+/g, '')
    if (squash(stored) !== squash(next)) {
      die(`${base}: the PATCH succeeded but the stored body differs from what was sent; check the dashboard (pre-push backup in ${join(OUT, 'backups')})`)
    }
    console.log(`${base}: stored body differs from the sent one only in whitespace`)
  }
  writeFileSync(f.json, JSON.stringify(after, null, 2))
  writeFileSync(f.orig, stored)
  writeFileSync(f.work, stored)
  console.log(`${base}: updated on ${opts.env}, updated_at ${after.updated_at}`)
}

if (command === 'list') {
  await list()
} else if (command === 'pull' || command === 'push') {
  if (!refs.length) die(`${command} needs at least one <ref>`)
  for (const ref of refs) await (command === 'pull' ? pull(ref) : push(ref))
} else {
  die(`unknown command "${command}"\n${USAGE}`)
}
