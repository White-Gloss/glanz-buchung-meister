import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./install-postgresql18.sh', import.meta.url))
// Set TEST_BASH when Bash is installed outside PATH (for example bundled Git on Windows).
const shell = process.env.TEST_BASH || (process.platform === 'win32' ? 'bash.exe' : '/bin/bash')
const shellPath = (value) => value.replaceAll('\\', '/')
const shellDirectory = shellPath(path.dirname(shell)).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
const shellPrelude = process.platform === 'win32' && path.isAbsolute(shell)
  ? `export PATH='${shellDirectory.replaceAll("'", "'\\''")}':$PATH\n`
  : ''
const fresh = [
  'Inst postgresql-client-common (291.pgdg24.04+1 apt.postgresql.org [all])',
  'Inst postgresql-common (291.pgdg24.04+1 apt.postgresql.org [all])',
  'Inst postgresql-client-18 (18.3-1.pgdg24.04+1 apt.postgresql.org [amd64])',
  'Inst postgresql-18 (18.3-1.pgdg24.04+1 apt.postgresql.org [amd64])',
  '0 upgraded, 4 newly installed, 0 to remove and 18 not upgraded.',
].join('\n')

function runGuard(body, plan = fresh) {
  const directory = mkdtempSync(path.join(tmpdir(), 'wg-pg18-guard-test-'))
  try {
    const fixture = path.join(directory, 'plan')
    writeFileSync(fixture, plan)
    const result = spawnSync(shell, ['-c', `${shellPrelude}source "$1"\n${body}`, 'test', shellPath(script), shellPath(fixture)], {
      encoding: 'utf8', timeout: 10_000,
    })
    assert.ifError(result.error)
    return result
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('installer parses as Bash and --help executes without system mutations', () => {
  const syntax = spawnSync(shell, ['-n', shellPath(script)], { encoding: 'utf8', timeout: 10_000 })
  assert.ifError(syntax.error)
  assert.equal(syntax.status, 0, syntax.stderr)
  const help = spawnSync(shell, [shellPath(script), '--help'], { encoding: 'utf8', timeout: 10_000 })
  assert.ifError(help.error)
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /prepare\|check\|install/)
})

test('simulation accepts only a bounded fresh server and client installation', () => {
  const accepted = runGuard('validate_plan "$2"')
  assert.equal(accepted.status, 0, accepted.stderr)
  for (const bad of [
    fresh.replace('0 upgraded', '1 upgraded'),
    fresh.replace('0 to remove', '1 to remove'),
    fresh.replace('Inst postgresql-common (', 'Inst postgresql-common [290] ('),
    `${fresh}\nRemv nginx [1.24]`,
    fresh.replace('4 newly', '5 newly'),
    fresh.replaceAll('postgresql-client-18', 'postgresql-client-16'),
    fresh.replaceAll('postgresql-18', 'postgresql-16'),
    `${fresh}\n0 upgraded, 4 newly installed, 0 to remove and 18 not upgraded.`,
    '0 upgraded, 0 newly installed, 0 to remove and 18 not upgraded.',
    `${Array.from({ length: 33 }, (_, i) => `Inst dependency-${i} (1 repo [all])`).join('\n')}\n${fresh.replace('4 newly', '37 newly')}`,
  ]) assert.notEqual(runGuard('validate_plan "$2"', bad).status, 0, bad)
})

test('PGDG verification accepts the exact sole primary fingerprint and rejects failures', () => {
  const valid = 'pub:-:4096:1:key:0:0::::\nfpr:::::::::B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8:\n'
  const cases = [
    [valid, 0],
    [valid.replace('B97B0A', '000000'), 1],
    [valid + valid, 1],
    ['', 1],
  ]
  for (const [output, expected] of cases) {
    const quoted = output.replaceAll("'", "'\\''")
    const result = runGuard(`work_dir=/unused\ngpg() { printf '%s' '${quoted}'; }\nverify_key /unused/key`)
    assert.equal(result.status === 0 ? 0 : 1, expected, result.stderr)
  }
  assert.notEqual(runGuard('work_dir=/unused\ngpg() { return 1; }\nverify_key /unused/key').status, 0)
})

test('process identity checks fail closed inside command substitutions', () => {
  const result = runGuard('live_pid=not-a-pid\nif identity=$(read_live_identity); then exit 90; fi\n[[ -z "$identity" ]]')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(runGuard('live_start=111\nread_live_identity() { printf "111\\n"; }\ncheck_live').status, 0)
  assert.notEqual(runGuard('live_start=111\nread_live_identity() { printf "222\\n"; }\ncheck_live').status, 0)
  assert.notEqual(runGuard('live_start=111\nread_live_identity() { return 1; }\ncheck_live').status, 0)
})

test('installation contract keeps service suppression ahead of apt and never starts services', () => {
  const source = readFileSync(script, 'utf8')
  const main = source.slice(source.indexOf('main() {'))
  assert.ok(main.indexOf('NEEDRESTART_SUSPEND=1') < main.indexOf('apt-get update'))
  assert.match(main, /apt-get update --error-on=any/)
  assert.match(main, /--no-install-recommends --no-upgrade --no-remove install postgresql-18 postgresql-client-18/)
  assert.match(main, /! -e "\$POLICY_PATH" && ! -L "\$POLICY_PATH"/)
  assert.match(main, /printf '#!\/bin\/sh\\nexit 101\\n'/)
  assert.match(main, /trap cleanup EXIT/)
  assert.match(source, /systemctl show white-gloss\.service --property=MainPID --value/)
  assert.doesNotMatch(source, /^\s*(?:systemctl|service|pg_ctlcluster)\s+(?:start|stop|restart|reload)\b/m)
  assert.doesNotMatch(source, /\bapt-get\s+(?:upgrade|dist-upgrade|autoremove)\b/)
})
