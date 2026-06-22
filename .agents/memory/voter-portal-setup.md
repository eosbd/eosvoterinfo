---
name: Voter Portal Setup Checklist
description: Steps required after a fresh environment start or deploy for the voter portal to work correctly.
---

## Required after every fresh environment start

1. **Install pymupdf** — not persisted across restarts:
   ```
   pip install pymupdf
   ```
   Then restart the API server workflow. Without this, all PDF/ZIP uploads return 0 rows silently.

2. **Run DB migrations** — if tables are missing:
   ```
   cd lib/db && pnpm run push
   ```

3. **Seed admin user** — if admin_users table is empty:
   ```js
   // node --input-type=module
   import pg from '/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js';
   const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
   await client.connect();
   // hash = sha256(password + "voter_portal_salt")
   await client.query(`INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING`, ['admin', '<hash>']);
   await client.end();
   ```
   Default credentials: admin / admin123

**Why:** pymupdf is a pip package not tracked by pnpm/nix. It gets wiped on container restart. The extraction pipeline (pdf_extract.py) silently returns [] when fitz import fails — no crash, just 0 rows.
