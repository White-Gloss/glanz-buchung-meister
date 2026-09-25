#!/usr/bin/env node
/**
 * Initial RO -> native Bitrix cutover. READ ONLY unless --apply is supplied.
 * Target .output must already be staged, root-owned and verified against the
 * digest of the reviewed build. Run from a complete operations checkout with pg.
 * This does not merge, build, extract archives, change CRM records, or start workers.
 * Never run another deployment concurrently. A SIGKILL/power failure requires
 * operator recovery using the private backup journal; no database restore is automatic.
 */
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export class CutoverError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function requireCondition(condition, code) {
  if (!condition) throw new CutoverError(code);
}
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const MAIN = "white-gloss.service";
export const KNOWN_WRITERS = [MAIN, "white-gloss-reminder.service", "white-gloss-reminder.timer"];

export function parseArgs(args) {
  const options = { apply: false, writers: [...KNOWN_WRITERS] };
  const seen = new Set();
  for (const arg of args) {
    if (arg === "--apply") {
      requireCondition(!options.apply, "duplicate_argument");
      options.apply = true;
      continue;
    }
    const match = /^--([a-z0-9-]+)=(.+)$/.exec(arg);
    requireCondition(match, "unknown_argument");
    const [, key, value] = match;
    requireCondition(key === "writer-unit" || !seen.has(key), "duplicate_argument");
    seen.add(key);
    if (key === "target-release") options.target = value;
    else if (key === "target-output-sha256") options.outputHash = value;
    else if (key === "prepared-env") options.preparedEnv = value;
    else if (key === "open-ro") {
      requireCondition(/^(0|[1-9][0-9]*)$/.test(value), "invalid_open_count");
      options.openCount = Number(value);
      requireCondition(Number.isSafeInteger(options.openCount), "invalid_open_count");
    } else if (key === "writer-unit") {
      requireCondition(
        /^white-gloss-[a-z0-9-]+\.(service|timer)$/.test(value),
        "invalid_writer_unit",
      );
      options.writers.push(value);
    } else throw new CutoverError("unknown_argument");
  }
  requireCondition(/^[a-f0-9]{40}$/.test(options.target || ""), "target_release_required");
  requireCondition(
    /^[a-f0-9]{64}$/.test(options.outputHash || ""),
    "reviewed_output_digest_required",
  );
  requireCondition(
    /^\/etc\/white-gloss\/[a-zA-Z0-9._-]+$/.test(options.preparedEnv || "") &&
      options.preparedEnv !== "/etc/white-gloss/environment",
    "protected_prepared_environment_required",
  );
  requireCondition(
    !options.apply || options.openCount !== undefined,
    "confirmed_open_count_required",
  );
  options.writers = [...new Set(options.writers)].sort();
  return options;
}

// EnvironmentFile is not a shell script. Reject syntax that this strict subset
// cannot preserve rather than evaluating it or silently interpreting escapes.
export function strictEnvironment(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    requireCondition(match && !Object.hasOwn(values, match[1]), "ambiguous_environment_file");
    let value = match[2].trim();
    requireCondition(!/[\\\0]/.test(value), "unsupported_environment_escaping");
    if (/^["']/.test(value)) {
      const quote = value[0];
      requireCondition(value.endsWith(quote), "invalid_environment_quote");
      value = value.slice(1, -1);
      requireCondition(!value.includes(quote), "unsupported_environment_escaping");
    } else requireCondition(!/["']/.test(value), "invalid_environment_quote");
    values[match[1]] = value;
  }
  return values;
}

export function validateEnvironmentPair(oldText, newText) {
  const previous = strictEnvironment(oldText);
  const target = strictEnvironment(newText);
  requireCondition(previous.BOOKING_OPERATIONS === "roapp", "previous_mode_must_be_roapp");
  requireCondition(target.BOOKING_OPERATIONS === "bitrix", "target_mode_must_be_bitrix");
  const allowed = new Set(["BOOKING_OPERATIONS", "BITRIX_WEBHOOK_URL"]);
  for (const name of new Set([...Object.keys(previous), ...Object.keys(target)])) {
    requireCondition(
      allowed.has(name) || previous[name] === target[name],
      "unrelated_environment_change",
    );
  }
  requireCondition(
    /^https:\/\/b24-emfor7\.bitrix24\.de\/rest\/\d+\/[A-Za-z0-9]+\/?$/.test(
      target.BITRIX_WEBHOOK_URL || "",
    ),
    "native_portal_webhook_required",
  );
  return { previous, target };
}

export function assertStable(before, after) {
  for (const key of [
    "currentRelease",
    "currentOutputHash",
    "targetRelease",
    "targetOutputHash",
    "oldText",
    "targetText",
    "dataFingerprint",
    "writerFingerprint",
    "migrationFingerprint",
    "nativeMappingFingerprint",
  ]) {
    if (before[key] !== after[key]) {
      const error = new CutoverError("state_changed_before_cutover");
      error.changedField = key;
      if (key === "dataFingerprint") {
        error.changedTables = [
          ...new Set([
            ...Object.keys(before.tableInventory || {}),
            ...Object.keys(after.tableInventory || {}),
          ]),
        ].filter(
          (table) =>
            /^[a-z_][a-z0-9_]*$/.test(table) &&
            JSON.stringify(before.tableInventory?.[table]) !==
              JSON.stringify(after.tableInventory?.[table]),
        );
      }
      throw error;
    }
  }
  requireCondition(before.openCount === after.openCount, "open_count_changed");
}

export function safeFailure(error) {
  return error instanceof CutoverError ? error.code : "cutover_operation_failed";
}

function report(plan, extra = {}) {
  return {
    previousRelease: plan.currentRelease,
    targetRelease: plan.targetRelease,
    openBookings: plan.openCount,
    pendingMigrations: plan.pendingMigrations,
    writers: plan.writers,
    ...extra,
  };
}

/** Side effects are injected as operations so failure ordering can be exercised. */
export async function runCutover(options, runtime) {
  const plan = await runtime.readPlan(options, false);
  if (options.openCount !== undefined)
    requireCondition(plan.openCount === options.openCount, "open_count_not_confirmed");
  if (!options.apply) return report(plan, { ok: true, readOnly: true });
  requireCondition(options.openCount !== undefined, "confirmed_open_count_required");
  const unlock = await runtime.lock();
  let stopAttempted = false;
  let migrationAttempted = false;
  let calendarAttempted = false;
  let backup;
  let phase = "before_stop";
  const checkpoint = () => runtime.checkInterrupted?.();
  try {
    checkpoint();
    const lockedPlan = await runtime.readPlan(options, false);
    assertStable(plan, lockedPlan);
    requireCondition(
      JSON.stringify(plan.writerStates) === JSON.stringify(lockedPlan.writerStates),
      "writer_state_changed",
    );
    phase = "stopping_writers";
    stopAttempted = true;
    await runtime.stop(plan.writers);
    checkpoint();
    const stable = await runtime.readPlan(options, true);
    assertStable(plan, stable);
    phase = "backup";
    backup = await runtime.backup(plan);
    requireCondition(backup?.verified === true, "backup_not_verified");
    checkpoint();
    phase = "migration";
    await runtime.journal(backup, phase);
    migrationAttempted = true;
    await runtime.migrate(plan);
    checkpoint();
    await runtime.verifySchema(plan, true);
    phase = "switching_pair";
    await runtime.journal(backup, phase);
    await runtime.verifyOriginal(plan);
    calendarAttempted = true;
    await runtime.calendarMode(plan, true);
    await runtime.swapEnvironment(plan.targetText);
    await runtime.swapRelease(plan.targetRelease);
    await runtime.verifyPair(plan, true);
    checkpoint();
    phase = "starting_target";
    await runtime.journal(backup, phase);
    await runtime.startMain();
    await runtime.health(plan.targetRelease);
    await runtime.assertWorkersStopped(plan.writers);
    checkpoint();
    await runtime.journal(backup, "healthy_workers_stopped");
    return report(plan, {
      ok: true,
      readOnly: false,
      backup: backup.path,
      workersStarted: false,
      requiresWorkerAcceptance: true,
    });
  } catch (error) {
    let restored = false;
    if (stopAttempted) {
      try {
        // Never let either version run while only half of the pair is restored.
        await runtime.stop(plan.writers);
        if (migrationAttempted) await runtime.verifySchema(plan, false);
        await runtime.guardRecovery(plan);
        if (calendarAttempted) await runtime.calendarMode(plan, false);
        await runtime.swapEnvironment(plan.oldText);
        await runtime.swapRelease(plan.currentRelease);
        await runtime.verifyPair(plan, false);
        await runtime.startPrevious(plan);
        restored = true;
      } catch {
        // Fail closed; do not start a service after an incomplete recovery.
        await runtime.stop(plan.writers).catch(() => {});
      }
    }
    if (backup)
      await runtime
        .journal(backup, restored ? "previous_pair_restored" : "operator_recovery_required")
        .catch(() => {});
    return report(plan, {
      ok: false,
      readOnly: false,
      code: safeFailure(error),
      ...(error instanceof CutoverError && error.code === "state_changed_before_cutover"
        ? {
            changedField: error.changedField,
            ...(error.changedTables ? { changedTables: error.changedTables } : {}),
          }
        : {}),
      phase,
      previousPairRestored: restored,
      requiresOperator: stopAttempted && !restored,
      ...(backup ? { backup: backup.path } : {}),
      databaseRestored: false,
    });
  } finally {
    await unlock().catch(() => {}); // Process exit also releases the kernel lock.
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    const options = parseArgs(process.argv.slice(2));
    const { createSystemRuntime } = await import("./cutover-bitrix-runtime.mjs");
    const runtime = createSystemRuntime(() =>
      requireCondition(!interrupted, "cutover_interrupted"),
    );
    const result = await runCutover(options, runtime);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: safeFailure(error) }));
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
  }
}
