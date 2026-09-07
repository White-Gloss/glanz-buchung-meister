import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectProcessEnvironment,
  parseProcessEnvironment,
} from "./inspect-process-environment.mjs";

test("parses NUL-separated values at the first equals sign without a prototype", () => {
  const env = parseProcessEnvironment(
    Buffer.from("TOKEN=abc==\0EMPTY=\0__proto__=safe\0ignored\0"),
  );
  assert.equal(Object.getPrototypeOf(env), null);
  assert.equal(env.TOKEN, "abc==");
  assert.equal(env.EMPTY, "");
  assert.equal(env.__proto__, "safe");
  assert.equal(env.ignored, undefined);
});

test("reads only the selected proc environment and returns redacted configuration", async () => {
  const paths = [];
  const report = await inspectProcessEnvironment("123", {
    platform: "linux",
    uid: 0,
    read: async (path) => {
      paths.push(path);
      return Buffer.from(
        [
          "DATABASE_URL=postgresql://secret-user:secret-password@db.example.invalid/app?password=secret-query",
          `BETTER_AUTH_SECRET=${"secret-auth-value".repeat(3)}`,
          "OWNER_EMAIL=private@example.invalid",
          "UNKNOWN_PRIVATE_VALUE=never-expose-this",
          "",
        ].join("\0"),
      );
    },
  });
  assert.deepEqual(paths, ["/proc/123/environ"]);
  assert.deepEqual(Object.keys(report), ["fields", "database"]);
  assert.deepEqual(report.fields.BETTER_AUTH_SECRET, { present: true, valid: true });
  assert.deepEqual(report.database, {
    present: true,
    valid: true,
    protocol: "postgresql",
    host: "db.example.invalid",
    database: "app",
  });
  assert.ok(
    !/secret-|private@example|never-expose|UNKNOWN_PRIVATE_VALUE/.test(JSON.stringify(report)),
  );
  assert.ok(
    Object.values(report.fields).every((field) =>
      Object.entries(field).every(
        ([key, value]) => ["present", "valid"].includes(key) && typeof value === "boolean",
      ),
    ),
  );
});

test("invalid PIDs and non-root or non-Linux execution never read files", async () => {
  let reads = 0;
  const read = async () => {
    reads++;
    return Buffer.alloc(0);
  };
  for (const pid of [undefined, 1, "", "0", "-1", "+1", "1/../2", "1x", " 1", "9007199254740992"])
    await assert.rejects(
      inspectProcessEnvironment(pid, { platform: "linux", uid: 0, read }),
      /invalid_pid/,
    );
  for (const context of [
    { platform: "win32", uid: 0 },
    { platform: "linux", uid: 1000 },
  ])
    await assert.rejects(
      inspectProcessEnvironment("123", { ...context, read }),
      /linux_root_required/,
    );
  assert.equal(reads, 0);
});

test("unreadable process environment does not expose the reader error", async () => {
  await assert.rejects(
    inspectProcessEnvironment("123", {
      platform: "linux",
      uid: 0,
      read: async () => {
        throw new Error("raw-sensitive-error");
      },
    }),
    { message: "process_environment_unreadable" },
  );
});
