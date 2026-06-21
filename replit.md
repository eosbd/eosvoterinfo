# Bangladesh Voter Portal

A full-stack web application to host, manage, and search Bangladesh voter information, with a public-facing search interface, a secure admin panel, file upload/processing, and a public REST API.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/voter-portal run dev` — run the frontend (port 22403)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + express-session + multer
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite + TailwindCSS + Recharts + Noto Sans Bengali
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/db/src/schema/voters.ts` — Voter table schema (all Bengali fields)
- `lib/db/src/schema/adminUsers.ts` — Admin user table
- `lib/db/src/schema/uploadJobs.ts` — Upload job tracking table
- `artifacts/api-server/src/routes/voters.ts` — Public voter search + CRUD routes
- `artifacts/api-server/src/routes/admin.ts` — Admin auth, dashboard, voter management
- `artifacts/api-server/src/routes/uploads.ts` — File upload (CSV auto-processed, PDF/XLSX/DOCX logged)
- `artifacts/voter-portal/src/` — React frontend (pages, components)

## Architecture decisions

- Session-based auth (express-session) instead of JWT — simpler for admin panel use case, server-side revocation
- Password hashing via SHA-256 + fixed salt (crypto module, no bcrypt dependency) — lightweight for low-auth-traffic admin tool
- Bengali text stored as UTF-8; `fixBengaliEncoding()` in uploads.ts handles common Bijoy/ANSI corruption patterns
- CSV files are auto-processed by the Node.js backend; PDF/XLSX/DOCX/ZIP files are uploaded and stored but require a Python extraction pipeline (pdfplumber/openpyxl) for data extraction
- All API contracts defined in OpenAPI first → Orval generates typed React Query hooks + Zod schemas

## Product

- **Public search**: Search voters by exact voter number (ভোটার নং) or by combining name, district, thana, ward
- **Voter profile**: Full record displayed in 3 sections — Personal Details, Address Details, Voter Area Details — with Bengali labels
- **Admin dashboard**: Total voter count + bar/pie charts by district and ward, recent upload activity
- **Admin voter table**: Searchable, filterable, editable, deletable voter records
- **File upload**: Drag-and-drop interface accepting ZIP, PDF, XLSX, DOCX, CSV; upload history with status tracking
- **Public REST API**: `GET /api/v1/search-voter` for third-party integrations

## Default admin credentials

- Username: `admin`
- Password: `admin123`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After adding new DB schema files, run `pnpm run typecheck:libs` before running api-server typecheck — stale lib declarations cause false "no exported member" errors
- The `uploadVoterFile` endpoint has no requestBody in OpenAPI (to avoid Orval/Zod `File` type collision with Node.js) — the frontend calls it directly with `fetch + FormData`
- Bengali font requires `Noto Sans Bengali` loaded from Google Fonts; apply to all Bengali text fields explicitly
- Session cookie `secure: false` in dev — must be `true` in production behind HTTPS proxy

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
