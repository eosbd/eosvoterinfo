#!/usr/bin/env node
/**
 * Bootstrap script — runs before the API server starts.
 * Safe to run multiple times (all operations are idempotent).
 *
 * What it does:
 *   1. Installs pymupdf (Python PDF extraction dependency)
 *   2. Pushes the DB schema (creates tables if missing)
 *   3. Seeds the default admin user (admin / admin123) if none exists
 *   4. Warns if SESSION_SECRET is unset (app still works with fallback)
 */

import { execSync, spawnSync } from "child_process";
import { createHash, randomBytes } from "crypto";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..");

const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const RESET  = "\x1b[0m";

function log(msg)  { console.log(`${GREEN}[setup]${RESET} ${msg}`); }
function warn(msg) { console.warn(`${YELLOW}[setup] ⚠${RESET}  ${msg}`); }
function err(msg)  { console.error(`${RED}[setup] ✗${RESET}  ${msg}`); }

// ── 1. pymupdf ────────────────────────────────────────────────────────────────
function installPymupdf() {
  const check = spawnSync("python3", ["-c", "import fitz"], { stdio: "pipe" });
  if (check.status === 0) {
    log("pymupdf already installed");
    return;
  }
  log("Installing pymupdf (PDF extraction)...");
  const res = spawnSync("pip", ["install", "pymupdf", "--quiet"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (res.status !== 0) {
    warn("pymupdf install failed — PDF extraction will not work");
  } else {
    log("pymupdf installed");
  }
}

// ── 2. DB schema push ─────────────────────────────────────────────────────────
function pushSchema() {
  if (!process.env.DATABASE_URL) {
    warn("DATABASE_URL not set — skipping DB schema push");
    warn("Set DATABASE_URL in Secrets (Tools → Secrets) then restart");
    return false;
  }
  log("Pushing DB schema...");
  try {
    execSync("pnpm --filter @workspace/db run push", {
      cwd: workspaceRoot,
      stdio: "pipe",
      timeout: 30_000,
    });
    log("DB schema up to date");
    return true;
  } catch (e) {
    err("DB schema push failed: " + (e.stderr?.toString() || e.message));
    return false;
  }
}

// ── 3. Seed admin user ────────────────────────────────────────────────────────
function seedAdmin() {
  if (!process.env.DATABASE_URL) return;

  const hash = createHash("sha256")
    .update("admin123" + "voter_portal_salt")
    .digest("hex");

  const sql = `
    INSERT INTO admin_users (username, password_hash)
    VALUES ('admin', '${hash}')
    ON CONFLICT (username) DO NOTHING;
  `;

  try {
    const res = spawnSync(
      "psql",
      [process.env.DATABASE_URL, "-c", sql],
      { stdio: "pipe", timeout: 15_000 },
    );
    if (res.status === 0) {
      log("Admin user seeded — username: admin  password: admin123");
    } else {
      warn("Admin seed via psql failed: " + (res.stderr?.toString() || "unknown"));
    }
  } catch (e) {
    warn("Admin seed failed: " + e.message);
  }
}

// ── 4. SESSION_SECRET check ───────────────────────────────────────────────────
function checkSessionSecret() {
  if (process.env.SESSION_SECRET) {
    log("SESSION_SECRET is set");
    return;
  }

  // Generate a stable secret from REPL_ID so it's consistent across restarts
  // but unique per Repl.
  const seed = process.env.REPL_ID || "dev-fallback";
  const generated = createHash("sha256").update(seed + "session").digest("hex");

  // Write to a local file so the app can load it
  const secretFile = resolve(workspaceRoot, ".session_secret");
  if (!existsSync(secretFile)) {
    writeFileSync(secretFile, generated);
  }

  warn("SESSION_SECRET not set in Secrets — using auto-generated value");
  warn("For production, add SESSION_SECRET to Secrets (Tools → Secrets)");

  // Inject into process.env so the API server picks it up
  process.env.SESSION_SECRET = readFileSync(secretFile, "utf8").trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────
log("=== Bangladesh Voter Portal — Bootstrap ===");

installPymupdf();
checkSessionSecret();
const dbOk = pushSchema();
if (dbOk) seedAdmin();

log("=== Bootstrap complete ===");
