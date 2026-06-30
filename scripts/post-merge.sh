#!/bin/bash
set -e
pnpm install --frozen-lockfile
node scripts/setup.mjs
echo "post-merge: done"
