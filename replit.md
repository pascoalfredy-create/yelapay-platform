# YelaPay+

A REST API backend for YelaPay+, a digital payment platform for informal transport (candongueiros, kupapatas, taxis) in Angola. Passengers and drivers transact in AOA (Angolan Kwanza) via digital wallets.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (one file per domain)
- `artifacts/api-server/src/routes/` — Express route handlers by domain
- `lib/api-zod/src/generated/` — generated Zod validators (server-side)
- `lib/api-client-react/src/generated/` — generated React Query hooks (client-side)

## Architecture decisions

- Contract-first: OpenAPI spec drives both Zod validators and React Query hooks via Orval codegen
- Wallets are auto-created when a user is registered; balance is stored as `numeric(14,2)` in AOA
- Trip payments atomically debit the passenger wallet and credit the driver wallet in a single request
- Route fare is used as the default payment amount if the passenger doesn't override it
- Numeric DB fields (`balance`, `amount`, `fare`) are serialized to `number` in JSON responses (not strings)

## Product

- **Users** — passengers, drivers, and admins with phone-based registration
- **Wallets** — each user has one digital wallet in AOA; supports top-up and peer transfer
- **Transactions** — immutable ledger of all wallet movements (topup, payment, transfer)
- **Routes** — named transport routes with origin, destination, fare, and distance
- **Vehicles** — candongueiros, kupapatas, and taxis registered to drivers
- **Trips** — a driver starts a trip on a route; passengers pay to board; trip is ended when complete
- **Stats** — platform-level dashboard aggregates (users, trips, volume, balances)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/users` | List users (filter: role, status, search) |
| POST | `/api/users` | Create user (auto-creates wallet) |
| GET | `/api/users/:id` | Get user |
| PATCH | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/api/users/:userId/wallet` | Get user's wallet |
| POST | `/api/wallets/:id/topup` | Top up wallet balance |
| POST | `/api/wallets/transfer` | Transfer between wallets |
| GET | `/api/transactions` | List transactions (filter: walletId, userId, type, status) |
| GET | `/api/transactions/:id` | Get transaction |
| GET | `/api/routes` | List routes |
| POST | `/api/routes` | Create route |
| GET | `/api/routes/:id` | Get route |
| PATCH | `/api/routes/:id` | Update route |
| DELETE | `/api/routes/:id` | Delete route |
| GET | `/api/routes/:id/stats` | Route usage statistics |
| GET | `/api/vehicles` | List vehicles (filter: driverId, routeId, status, type) |
| POST | `/api/vehicles` | Register vehicle |
| GET | `/api/vehicles/:id` | Get vehicle |
| PATCH | `/api/vehicles/:id` | Update vehicle |
| DELETE | `/api/vehicles/:id` | Delete vehicle |
| GET | `/api/trips` | List trips (filter: routeId, driverId, vehicleId, status) |
| POST | `/api/trips` | Start a trip |
| GET | `/api/trips/:id` | Get trip |
| PATCH | `/api/trips/:id` | Update trip (e.g. end or cancel) |
| POST | `/api/trips/:id/pay` | Passenger pays for trip |
| GET | `/api/trips/:id/payments` | List trip payments |
| GET | `/api/stats` | Platform-wide statistics |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always run `pnpm --filter @workspace/api-spec run codegen` before typechecking the server
- Query param Zod schemas are named `*QueryParams` (e.g. `ListUsersQueryParams`), not `*Params`
- Numeric Drizzle columns (`numeric`) return strings from the DB — always `parseFloat()` before sending JSON

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
