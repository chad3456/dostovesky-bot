// Pre-build step for hosted deploys.
//
// `prisma generate` always runs (the client must exist for the build to
// compile). `prisma migrate deploy` only runs when a DATABASE_URL is present —
// so the app can also be deployed with NO backend at all (the home page `/` is
// a fully client-side reader that needs no database).
import { execSync } from "node:child_process";

function run(cmd) {
  console.log(`▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

run("prisma generate");

if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL detected — applying migrations.");
  run("prisma migrate deploy");
} else {
  console.log("No DATABASE_URL — skipping migrations (client-only deploy).");
}
