import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { panelEnvironment, stagePanelEnvironment } from './stage-panel-environment.mjs';

test('panel staging preserves every secret and unrelated integration and collapses legacy modes', () => {
  const source = 'DATABASE_URL=postgres://test.invalid/database\nBOOKING_OPERATIONS=roapp\nROAPP_API_KEY=synthetic\nBITRIX_WEBHOOK_URL=synthetic\nMAIL_TRANSPORT=smtp\nBOOKING_OPERATIONS=bitrix\n';
  const result = panelEnvironment(source);
  assert.equal(result.match(/^BOOKING_OPERATIONS=/gm).length, 1);
  assert.match(result, /^BOOKING_OPERATIONS=panel$/m);
  for (const line of source.split('\n').filter(line => line && !line.startsWith('BOOKING_OPERATIONS=')))
    assert.ok(result.includes(line));
  assert.equal(panelEnvironment(result), result);
  assert.throws(() => panelEnvironment('BOOKING_OPERATIONS=roapp\n'), /database_configuration_missing/);
});

test('staging is exclusive, private and leaves the active configuration untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wg-panel-stage-'));
  assert.match(relative(tmpdir(), directory), /^wg-panel-stage-[^\\/]+$/);
  await chmod(directory, 0o700);
  const source = join(directory, 'active.env'), output = join(directory, 'staged.env');
  const original = 'DATABASE_URL=postgres://test.invalid/db\nBOOKING_OPERATIONS=roapp\n';
  try {
    await writeFile(source, original, { mode: 0o600 });
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
      await assert.rejects(stagePanelEnvironment({ source, output }), /output_directory_must_be_root_protected/);
      assert.equal(await readFile(source, 'utf8'), original);
      return;
    }
    const result = await stagePanelEnvironment({ source, output });
    assert.equal(result.mode, 'panel');
    assert.equal(result.activated, false);
    assert.equal(await readFile(source, 'utf8'), original);
    assert.equal(await readFile(output, 'utf8'), panelEnvironment(original));
    await assert.rejects(stagePanelEnvironment({ source, output }), /EEXIST/);
    await assert.rejects(stagePanelEnvironment({ source, output: source }), /separate_output_required/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
