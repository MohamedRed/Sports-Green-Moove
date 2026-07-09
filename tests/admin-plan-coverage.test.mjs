import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const dashboard = read("admin/src/AdminDashboard.tsx");
const clubTables = read("admin/src/ClubOperationsTables.tsx");
const packageJson = read("package.json");

for (const collection of [
  "users",
  "clubs",
  "teams",
  "memberships",
  "trips",
  "bookings",
  "rideSessions",
  "reports",
  "rewardLedger",
  "stripeAccounts",
]) {
  includes(dashboard, `useCollection("${collection}"`, `Admin dashboard reads ${collection}`);
}

for (const section of [
  'id="clubs"',
  'id="teams"',
  'id="memberships"',
]) {
  includes(clubTables, section, `Club operations renders ${section}`);
}

includes(dashboard, "ClubOperationsTables", "Admin dashboard renders club operations tables");
includes(dashboard, "PayoutsTable", "Admin dashboard renders payouts");
includes(dashboard, "ReportsTable", "Admin dashboard renders support reports");
includes(packageJson, "test:admin-plan-coverage", "Admin plan coverage test is wired");

console.log("Admin plan coverage checks passed.");

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), `${message}: missing ${needle}`);
}

