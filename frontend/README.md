# MobileERP — Frontend

React 19 + TypeScript client for the MobileERP API. See the [root README](../README.md) for the project overview, architecture and full setup.

## Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Routing | React Router 7 |
| Server state | TanStack Query 5 |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| HTTP | Axios |
| Tests | Vitest, Testing Library, MSW |

## Setup

Requires the backend running at `http://localhost:8000` (see the [root README](../README.md)).

```bash
npm install
cp .env.example .env
npm run dev
```

Available at <http://localhost:5173>.

### Environment

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API, including the `/api/v1` prefix. Defaults to `http://localhost:8000/api/v1` in development. |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once (Vitest) |
| `npm run lint` | Lint with ESLint |

## Structure

```
src/
├── app/           # router and route-level tests
├── auth/          # auth context, token storage, route guards
├── features/      # one folder per business area, each with its own
│                  #   api client, query hooks, schemas and components
├── components/    # shared design system primitives
├── layouts/       # application shell
├── pages/         # login, home, not-found
├── hooks/         # shared hooks
├── lib/           # axios client, query configuration, formatters
├── types/         # shared TypeScript types
└── test/          # test setup and MSW handlers
```

### Feature folders

Each area under `features/` is self-contained — its API client (`api.ts`), React Query hooks (`hooks/`), types (`types/`), error mapping (`errors.ts`), formatters (`format.ts`) and components live together:

`dashboard` · `catalog` · `inventory` · `purchases` · `sales` · `customers` · `suppliers` · `reports` · `administration` · `account`

## Conventions

- **Server state belongs to TanStack Query**, never to `useState`. Queries are keyed per feature and invalidated on mutation.
- **Retries are deterministic-aware**: `lib/queryRetry.ts` disables retrying on 4xx responses, since the backend has already decided and retrying only delays rendering the error state. Network errors and 5xx keep the default retry behavior.
- **Forms are validated with Zod** and wired through `@hookform/resolvers`, so the schema is the single source of truth for both types and validation.
- **API errors map to user-facing messages** in each feature's `errors.ts`, keyed by the backend's HTTP status and `detail` payload.
- **Route-level tests use MSW** rather than mocked modules — the router is exercised against realistic HTTP responses instead of stubbed API functions.
