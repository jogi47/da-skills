import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const script = fileURLToPath(new URL('../scripts/os-templates.mjs', import.meta.url))
const appId = '11111111-1111-4111-8111-111111111111'
const templateId = '22222222-2222-4222-8222-222222222222'

function fixture (t, { customKeys = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'onesignal-skill-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const state = join(dir, 'state.json')
  const config = join(dir, 'config.env')
  const appKey = customKeys ? 'PROJECT_APP' : 'ONESIGNAL_APP_ID'
  const apiKey = customKeys ? 'PROJECT_KEY' : 'ONESIGNAL_API_KEY'
  writeFileSync(config, `${appKey}=${appId}\n${apiKey}=test-only-placeholder\nRECEIPT_TEMPLATE_ID=${templateId}\n`)
  writeFileSync(state, JSON.stringify({
    calls: [],
    template: { id: templateId, name: 'Receipt', updated_at: '2026-01-01', content: {
      email_body: '<p>Before</p>', email_subject: 'Your receipt', email_from_name: 'Example',
      email_from_address: 'noreply@example.invalid', disable_email_click_tracking: true
    } }
  }))
  const preload = join(dir, 'mock-fetch.mjs')
  // Every fetch is intercepted. No socket or external account is used by these tests.
  writeFileSync(preload, `
import { readFileSync, writeFileSync } from 'node:fs'
const statePath = ${JSON.stringify(state)}
globalThis.fetch = async (url, options) => {
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  const u = new URL(url)
  if (u.origin !== 'https://api.onesignal.com' || u.searchParams.get('app_id') !== ${JSON.stringify(appId)}) throw new Error('Unexpected API target')
  const scheme = options.headers.Authorization.split(' ')[0]
  state.calls.push({ method: options.method, scheme })
  if (options.method === 'PATCH') {
    const body = JSON.parse(options.body)
    state.template.name = body.name
    for (const [key, value] of Object.entries(body)) {
      if (key !== 'name' && key !== 'isEmail') state.template.content[key] = value
    }
    if (state.corruptSettings) state.template.content.email_subject = 'Unexpected subject'
  }
  writeFileSync(statePath, JSON.stringify(state))
  if (state.httpError) return new Response('test-only-placeholder private error', { status: 403 })
  const body = u.pathname === '/templates'
    ? { templates: [state.template], total_count: 1 }
    : state.template
  return new Response(JSON.stringify(body), { status: 200 })
}
`)
  const extra = customKeys ? ['--app-id-key', appKey, '--api-key-key', apiKey] : []
  const output = join(dir, 'tmp/onesignal/review-qa')
  const run = (command, ...args) => spawnSync(process.execPath, [
    '--import', preload, script, command,
    '--env', 'review-qa', '--env-file', config, ...extra, ...args
  ], { cwd: dir, encoding: 'utf8' })
  const read = () => JSON.parse(readFileSync(state, 'utf8'))
  const update = (fn) => { const data = read(); fn(data); writeFileSync(state, JSON.stringify(data)) }
  const pullAndEdit = () => {
    assert.equal(run('pull', 'RECEIPT_TEMPLATE_ID').status, 0)
    writeFileSync(join(output, 'RECEIPT_TEMPLATE_ID.html'), '<p>After</p>')
  }
  return { dir, state, output, run, read, update, pullAndEdit }
}

test('portable output is relative to invocation directory; custom credential keys and legacy auth work', (t) => {
  const f = fixture(t, { customKeys: true })
  const r = f.run('pull', 'RECEIPT_TEMPLATE_ID', '--auth-scheme', 'Basic')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readFileSync(join(f.output, 'RECEIPT_TEMPLATE_ID.html'), 'utf8'), '<p>Before</p>')
  assert.ok(readdirSync(join(f.output, 'backups')).length)
  assert.equal(f.read().calls[0].scheme, 'Basic')
  assert.ok(!r.stdout.includes('test-only-placeholder'))
})

test('list and exact-name pull work with an explicit output path and default Key auth', (t) => {
  const f = fixture(t)
  const listed = f.run('list')
  assert.equal(listed.status, 0, listed.stderr)
  assert.match(listed.stdout, /RECEIPT_TEMPLATE_ID/)
  assert.ok(!listed.stdout.includes(templateId))
  const customOut = resolve(f.dir, 'private-export')
  assert.equal(f.run('pull', 'name:Receipt', '--out', customOut).status, 0)
  assert.ok(existsSync(join(customOut, 'name-Receipt.html')))
  assert.ok(f.read().calls.every(c => c.method === 'GET' && c.scheme === 'Key'))
})

test('a normal push is a dry run and does not patch the remote template', (t) => {
  const f = fixture(t); f.pullAndEdit()
  const r = f.run('push', 'RECEIPT_TEMPLATE_ID')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /dry run, nothing sent/)
  assert.match(r.stdout, /Before/)
  assert.match(r.stdout, /After/)
  assert.equal(f.read().template.content.email_body, '<p>Before</p>')
  assert.ok(f.read().calls.every(c => c.method === 'GET'))
})

test('apply needs a live-change acknowledgement regardless of environment label', (t) => {
  const f = fixture(t); f.pullAndEdit()
  const r = f.run('push', 'RECEIPT_TEMPLATE_ID', '--apply')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /allow-live/)
  assert.ok(f.read().calls.every(c => c.method === 'GET'))
})

test('acknowledged apply preserves settings, verifies the update and refreshes snapshots', (t) => {
  const f = fixture(t); f.pullAndEdit()
  const before = f.read().template.content
  const r = f.run('push', 'RECEIPT_TEMPLATE_ID', '--apply', '--allow-live')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(f.read().template.content.email_body, '<p>After</p>')
  for (const key of Object.keys(before).filter(k => k !== 'email_body')) {
    assert.equal(f.read().template.content[key], before[key])
  }
  assert.equal(f.read().calls.filter(c => c.method === 'PATCH').length, 1)
  assert.equal(f.read().calls.at(-1).method, 'GET')
  assert.equal(readFileSync(join(f.output, 'RECEIPT_TEMPLATE_ID.orig.html'), 'utf8'), '<p>After</p>')
})

test('a changed live body blocks apply and preserves local edits', (t) => {
  const f = fixture(t); f.pullAndEdit()
  f.update(s => { s.template.content.email_body = '<p>Someone else changed it</p>' })
  const r = f.run('push', 'RECEIPT_TEMPLATE_ID', '--apply', '--allow-live')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /live template changed/)
  assert.ok(f.read().calls.every(c => c.method === 'GET'))
  assert.equal(readFileSync(join(f.output, 'RECEIPT_TEMPLATE_ID.html'), 'utf8'), '<p>After</p>')
})

test('pull does not overwrite unpushed edits and unbalanced Liquid blocks a push', (t) => {
  const f = fixture(t); f.pullAndEdit()
  assert.notEqual(f.run('pull', 'RECEIPT_TEMPLATE_ID').status, 0)
  writeFileSync(join(f.output, 'RECEIPT_TEMPLATE_ID.html'), '{% if value %}<p>After</p>')
  const r = f.run('push', 'RECEIPT_TEMPLATE_ID', '--apply', '--allow-live')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /unbalanced Liquid/)
  assert.ok(f.read().calls.every(c => c.method === 'GET'))
})

test('verification detects settings changed by the API after a patch', (t) => {
  const f = fixture(t); f.pullAndEdit()
  f.update(s => { s.corruptSettings = true })
  const r = f.run('push', 'RECEIPT_TEMPLATE_ID', '--apply', '--allow-live')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /update changed email_subject/)
  assert.ok(readdirSync(join(f.output, 'backups')).length)
})

test('invalid environment labels and references are rejected before a remote request', (t) => {
  const f = fixture(t)
  assert.notEqual(f.run('list', '--env', '../escape').status, 0)
  assert.notEqual(f.run('pull', '../escape').status, 0)
  assert.equal(f.read().calls.length, 0)
})

test('HTTP failures omit potentially private response bodies', (t) => {
  const f = fixture(t)
  f.update(s => { s.httpError = true })
  const r = f.run('list')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /HTTP 403/)
  assert.ok(!r.stderr.includes('test-only-placeholder'))
})
