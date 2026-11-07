import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = {
  app: read("admin/src/App.tsx"),
  main: read("admin/src/main.tsx"),
  page: read("admin/src/PrivacyPolicyPage.tsx"),
  wordmark: read("admin/src/Wordmark.tsx"),
  styles: read("admin/src/privacy.css"),
  website: read("website/index.html"),
  firebase: read("firebase.json"),
  dataSafety: read("docs/release/privacy-data-safety.md"),
  packageJson: read("package.json"),
  releaseReadiness: read(".github/workflows/release-readiness.yml"),
  webSmoke: read(".github/workflows/web-integration-smoke.yml"),
};

const routeCheckIndex = files.main.indexOf("isPublicPrivacyRoute(pathname)");
const privacyImportIndex = files.main.indexOf('import("./PrivacyPolicyPage")');
const appImportIndex = files.main.indexOf('import("./App")');
const authIndex = files.app.indexOf("const auth = useAdminAuth()");
assert.ok(routeCheckIndex >= 0, "Admin entry must check the public privacy route.");
assert.ok(privacyImportIndex >= 0, "Admin entry must lazy-load the privacy route.");
assert.ok(appImportIndex >= 0, "Admin entry must lazy-load the private admin app.");
assert.ok(authIndex >= 0, "Admin app should still use Firebase admin auth for private routes.");
assert.ok(privacyImportIndex < appImportIndex, "The public /privacy route must bypass the admin app bundle.");
assert.ok(!files.app.includes("PrivacyPolicyPage"), "Private admin app should not import the public privacy route.");

includes(files.main, 'pathname === "/privacy"', "Admin entry routes /privacy publicly.");
includes(files.main, 'pathname === "/privacy/"', "Admin entry routes /privacy/ publicly.");
includes(files.main, './privacy.css', "Admin entry imports privacy route styles.");
includes(files.page, './Wordmark', "Privacy page reuses the shared wordmark without importing App.");
includes(files.app, './Wordmark', "Admin auth pages reuse the shared wordmark component.");
includes(files.wordmark, 'aria-label="Sports Green Moove"', "Shared wordmark keeps the accessible label.");
includes(files.firebase, '"public": "admin/dist"', "Firebase Hosting serves the admin build that contains /privacy.");
includes(files.website, 'href="/privacy"', "Marketing footer links to the public privacy route.");

for (const expectedCopy of [
  "Politique de confidentialite",
  "Derniere mise a jour: 17 juin 2026",
  "Pas de vente de donnees",
  "Suivi limite aux trajets actifs",
  "Consentement responsable legal",
  "Localisation et securite enfant",
  "Suppression et droits",
]) {
  includes(files.page, expectedCopy, `Privacy page includes ${expectedCopy}.`);
}

for (const processorUrl of [
  "https://firebase.google.com/support/privacy",
  "https://www.facebook.com/privacy/policy/",
  "https://radar.com/privacy",
  "https://policies.google.com/privacy",
  "https://stripe.com/privacy",
]) {
  includes(files.dataSafety, processorUrl, `Data-safety source includes ${processorUrl}.`);
  includes(files.page, processorUrl, `Privacy page publishes ${processorUrl}.`);
}

for (const category of [
  "Identite du compte",
  "Enfants et responsables",
  "Localisation precise",
  "Paiements",
  "Messages et signalements",
  "Impact environnemental",
]) {
  includes(files.page, category, `Privacy page includes data category ${category}.`);
}

includes(files.styles, "@media (max-width: 760px)", "Privacy page has a mobile layout.");
includes(files.styles, "overflow-x: auto", "Privacy data table remains usable on narrow screens.");
includes(files.styles, "content: attr(data-label)", "Privacy data table collapses into labelled mobile rows.");
includes(files.page, 'data-label="Categorie"', "Privacy data table provides mobile row labels.");
includes(files.packageJson, '"test:privacy-policy-page"', "Root package exposes privacy page validation.");
includes(files.releaseReadiness, "npm run test:privacy-policy-page", "Release Readiness validates the public privacy route.");
includes(files.webSmoke, "npm run test:privacy-policy-page", "Web Integration Smoke validates the public privacy route.");

console.log("Privacy policy page checks passed.");

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message);
}
