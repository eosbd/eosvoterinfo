#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push

# Seed default admin user (admin / admin123) if not already present
HASH=$(node -e "const c=require('crypto');console.log(c.createHash('sha256').update('admin123'+'voter_portal_salt').digest('hex'))")
psql "$DATABASE_URL" -c "
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '$HASH')
ON CONFLICT (username) DO NOTHING;
" 2>/dev/null || true

# Install Python PDF extraction dependency
pip install pymupdf --quiet 2>/dev/null || true

echo "post-merge: done"
