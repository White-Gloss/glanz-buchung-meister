import pg from "pg";
import { checkReleaseSchema, releaseConfigurationProblems } from "../../scripts/release-policy.mjs";
import migrationNames from "../release-migrations.generated.json";

let checked: Promise<boolean> | undefined;
let failedAt = 0;

async function ready(): Promise<boolean> {
  const problems = releaseConfigurationProblems(process.env);
  if (problems.length) {
    for (const problem of problems) console.error(`[release] ${problem}`);
    return false;
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.trim(),
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  try {
    const issues = await checkReleaseSchema((text: string) => pool.query(text), migrationNames);
    for (const issue of issues) console.error(`[release] ${issue}`);
    return issues.length === 0;
  } catch {
    console.error(
      "[release] Datenbankprüfung fehlgeschlagen; keine Verbindungsdetails protokolliert.",
    );
    return false;
  } finally {
    await pool.end();
  }
}

// The existing deployment helper checks GET / before keeping a new release.
// This gate runs before handlers, including auth, and performs no DDL or writes.
export default async function releaseReadiness(_event: unknown, next: () => unknown) {
  const localPreview =
    process.env.ALLOW_LOCAL_PGLITE === "1" &&
    !process.env.DATABASE_URL?.trim() &&
    ["127.0.0.1", "::1", "localhost"].includes(process.env.HOST || "");
  if (localPreview) return next();
  if (failedAt && Date.now() - failedAt >= 5000) {
    checked = undefined;
    failedAt = 0;
  }
  checked ??= ready().then((passed) => {
    if (!passed) failedAt = Date.now();
    return passed;
  });
  if (!(await checked))
    return new Response("Der Dienst ist vorübergehend nicht verfügbar.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "60",
      },
    });
  return next();
}
