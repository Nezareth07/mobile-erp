# MobileERP

A full-stack ERP for mobile phone and consumer electronics retail, built around a problem most generic ERPs handle badly: **a single catalog that mixes individually-tracked goods with quantity-tracked goods.**

A phone is not interchangeable with another phone — it has an IMEI, a specific purchase cost, a warranty history, and a buyer. A screen protector is interchangeable with every other screen protector in the same batch. MobileERP models both in one inventory subsystem, and every purchase, sale and report downstream respects the difference.

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0%20async-D71F00)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-58%20files-success)

> **Status:** actively developed. Core ERP flows (catalog, inventory, purchasing, sales, auth, reporting) are implemented, documented and covered by tests. See [Roadmap](#roadmap).

---

## Screenshots

### Dashboard

Period KPIs, daily sales chart, best-selling products and top customers.

![Dashboard](docs/images/dashboard.png)

### Inventory

Stock valuation listing the three tracking types side by side — untracked, batch and serial (IMEI) — with available quantity and total value per product.

![Inventory](docs/images/inventory.png)

### Sales

New sale form: customer selection, product line, and the available stock for the selected product shown inline before the sale is registered.

![New sale](docs/images/new-sale.png)

### Purchases

Purchase list with supplier, date, line count, total cost and status.

![Purchases](docs/images/purchases.png)

### Role-Based Access Control

Roles with the number of permissions granted to each and their status.

![Roles](docs/images/roles.png)

### Reports

Sales report over a date range: sale count, revenue, real cost, profit and margin, with a daily breakdown, best-selling products and top customers.

![Sales report](docs/images/reports.png)

---

## Table of contents

- [Screenshots](#screenshots)
- [Why this project is interesting](#why-this-project-is-interesting)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Modules](#modules)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why this project is interesting

These are the design decisions worth reading the code for.

### Dual inventory traceability

`Product.tracking_type` decides how a product is tracked, and the whole inventory subsystem branches on it:

| Tracking type | Backing table | Identity | Used for |
|---|---|---|---|
| `serial` | `ProductUnit` | One row per physical unit, keyed by IMEI | Phones |
| `batch` / `none` | `StockLot` | One row per received lot, with a quantity | Accessories, chargers, cases |

A serial sale consumes one specific `ProductUnit` and inherits *that unit's* cost. A batch sale consumes lots in **FIFO** order by `received_at`, potentially spanning several lots for a single line.

### An immutable stock ledger

`StockMovement` is append-only. It is never edited and never deleted — corrections are modeled as new movements, not as mutations of history. A database constraint (`exactly_one_stock_reference`) guarantees every movement points at exactly one of `product_unit_id` or `stock_lot_id`, never both and never neither.

### Atomic multi-entity use cases

Registering a purchase or a sale touches the header, its lines, `ProductUnit`/`StockLot`, and the movement ledger. These run as **one transaction with a single commit**:

- Simple services (`Supplier`, `Customer`, `Product`, `Brand`, `Category`) commit per method.
- Orchestrating services (`Purchase`, `Sale`) only `flush()` internally and commit **once** at the end of the use case.
- `InventoryService` **never** commits — it is always invoked by an owner of the transaction, so it can be composed into any flow without fighting over transaction boundaries.

### Frozen cost of goods sold

When a sale is confirmed, `total_amount`, `total_cost` and `profit` are computed once and **never recalculated**. `Product.cost_price` is only a "last purchase cost" reference; the real COGS comes from the units and lots actually consumed. This is what keeps a profit report from last quarter correct after this quarter's prices change.

### Correctness under concurrent writes

Business invariants are enforced at the database level, not just in application code, and each one is verified by a real concurrency test — no mocks, no `sleep()`, just `asyncio.gather` against live sessions:

- **Row-level locking** (`SELECT ... FOR UPDATE`) serializes deactivating a role against assigning it, and selling a unit against selling it again.
- **Partial unique indexes** guarantee at most one active default customer (`WHERE is_default_customer IS TRUE AND is_active IS TRUE`) and allow many customers without a document ID while keeping the ID unique when present.
- **A last-admin guard** prevents locking every administrator out of the system.

### Test isolation without touching production code

Each test runs inside a real Postgres transaction joined in `create_savepoint` mode. When application code calls `session.commit()`, SQLAlchemy translates it into releasing and reopening a savepoint — the outer transaction is rolled back at the end of the test and never commits. No service, router or repository was modified to make testing possible; it is resolved entirely in `conftest.py` via `dependency_overrides`. The schema is built by running the **real Alembic migrations**, not `create_all()`, because the migrations are what seed the 28 permissions and the ADMIN role.

---

## Architecture

A strict layered architecture, replicated identically in every business module.

```mermaid
flowchart LR
    R[Router<br/><small>HTTP, Pydantic validation</small>]
    S[Service<br/><small>business rules, transactions</small>]
    P[Repository<br/><small>queries only</small>]
    M[(PostgreSQL)]

    R --> S --> P --> M
```

| Layer | Responsibility | Never does |
|---|---|---|
| **Router** | Receives the validated request, resolves the service via `Depends()`, calls exactly one service method | Business logic, data access |
| **Service** | Business rules, orchestration, transaction boundaries, typed domain exceptions | Build its own session, return Pydantic schemas |
| **Repository** | `select`, `with_for_update`, `selectinload`, aggregations | Business rules, `commit()`, `flush()` |
| **Model** | SQLAlchemy declarative tables, constraints, relationships | Anything else |

**Service encapsulation rule.** A service may read another *simple* entity's repository for validation, but no service ever reaches into `InventoryService`'s repositories. Every stock mutation in the system — from purchasing, from selling, from manual adjustment — goes through `InventoryService`'s public methods. That is what makes the ledger trustworthy.

**Error handling.** Four plain domain exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`, plus `Unauthorized`/`Forbidden` for auth) are registered as global handlers and map to fixed HTTP status codes. A global `IntegrityError` handler returns `409` as a safety net for races that slip past pre-write validation.

---

## Tech stack

**Backend**

| Concern | Choice |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2.0, fully async (`Mapped` / `mapped_column`) |
| Driver | asyncpg |
| Database | PostgreSQL 17 |
| Migrations | Alembic (async `env.py`) |
| Validation | Pydantic v2 (`from_attributes=True` throughout) |
| Config | pydantic-settings, nested env vars (`DATABASE__URL`) |
| Auth | PyJWT (access + refresh), bcrypt |
| Tests | pytest, pytest-asyncio, httpx |

**Frontend**

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Routing | React Router 7 |
| Server state | TanStack Query 5 |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Tests | Vitest, Testing Library, MSW |

---

## Modules

**Backend** — 9 domain modules, 14 routers, 69 REST endpoints under `/api/v1`.

| Module | What it does |
|---|---|
| `auth` | Users, roles, granular permissions, JWT login/refresh, admin bootstrap CLI |
| `product` | Products, brands and categories; defines `tracking_type` |
| `inventory` | Locations, product units (IMEI), stock lots (FIFO), immutable movement ledger |
| `supplier` | Supplier catalog |
| `purchase` | Atomic goods receipt: validates lines, creates stock, updates cost |
| `customer` | Customer registry, including the configurable default "walk-in" customer |
| `sale` | Atomic sale: availability check, stock consumption, real COGS and profit |
| `dashboard` | Read-only consolidated business indicators |
| `report` | Sales, purchasing and inventory reporting |

**Frontend** — 10 feature areas: `dashboard`, `catalog`, `inventory`, `purchases`, `sales`, `customers`, `suppliers`, `reports`, `administration`, `account`.

---

## Getting started

### Prerequisites

- Python 3.13+
- Node.js 20+
- Docker (for PostgreSQL)

### 1. Database

```bash
docker compose up -d
```

Starts PostgreSQL 17 on port `5433`. The API itself runs locally, outside Docker.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

pip install -e ".[test]"
cp .env.example .env
```

Edit `.env` and set at minimum:

```dotenv
DATABASE__URL=postgresql+asyncpg://postgres:postgres@localhost:5433/mobileerp
SECURITY__SECRET_KEY=<generate one, see below>
API__CORS_ORIGINS=["http://localhost:5173"]
```

Generate a secret key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Apply migrations and create the first administrator:

```bash
alembic upgrade head
python -m app.cli.bootstrap_admin
```

The bootstrap command prompts for the password without echoing it, and is idempotent — if an active ADMIN already exists it changes nothing.

Run the API:

```bash
uvicorn app.main:app --reload
```

Interactive API docs: <http://localhost:8000/docs>

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Available at <http://localhost:5173>.

---

## Testing

**Backend** — requires a separate `mobileerp_test` database on the same server. `conftest.py` points there explicitly and will never touch the development database.

```bash
createdb -h localhost -p 5433 -U postgres mobileerp_test
cd backend
pytest
```

Suites: unit (`test/unit`), integration (`test/integration`) and real concurrency (`test/concurrency`).

**Frontend**

```bash
cd frontend
npm test
```

---

## Project structure

```
mobile-erp/
├── docker-compose.yml          # PostgreSQL 17
├── backend/
│   ├── alembic/versions/       # migrations
│   ├── app/
│   │   ├── main.py             # app, routers, exception handlers
│   │   ├── cli/                # bootstrap_admin
│   │   ├── core/               # config, database, base repository, exceptions
│   │   └── modules/<module>/
│   │       ├── models/         # SQLAlchemy tables
│   │       ├── schemas/        # Create / Update / Response / Summary
│   │       ├── repositories/   # queries
│   │       ├── services/       # business rules and transactions
│   │       ├── routers/        # endpoints
│   │       ├── enums/
│   │       └── dependencies.py
│   ├── docs/                   # architecture documentation
│   └── test/{unit,integration,concurrency}/
└── frontend/
    └── src/
        ├── app/                # router
        ├── auth/               # auth context and guards
        ├── features/<area>/    # api, hooks, components per feature
        ├── components/         # design system
        ├── layouts/
        └── lib/
```

---

## Documentation

In-depth technical documentation lives in [`backend/docs/`](backend/docs/) *(written in Spanish)*:

| Document | Contents |
|---|---|
| [`architecture.md`](backend/docs/architecture.md) | Layers, patterns, dependency injection, request lifecycle |
| [`domain-model.md`](backend/docs/domain-model.md) | Every entity, its relationships, business rules and fields |
| [`transaction-flow.md`](backend/docs/transaction-flow.md) | Commit/flush boundaries, COGS calculation, FIFO consumption |
| [`api-conventions.md`](backend/docs/api-conventions.md) | Naming, soft delete, response models, status codes |
| [`backend-roadmap.md`](backend/docs/backend-roadmap.md) | Delivered modules, pending work, known technical debt |

---

## Roadmap

**Delivered** — catalog (brands, categories, products), inventory, suppliers, purchasing, customers, sales, authentication and authorization, dashboard, reporting, and the full React frontend.

**Planned**

| Module | Purpose |
|---|---|
| Returns | Partial or total return of a confirmed sale. The schema already anticipates it: `ProductUnit.sale_line_id` traces which sale took each unit, and `RETURN_IN` / `RETURN_OUT` movement types exist. |
| Warranty | Warranty claims on sold units. `ProductUnitStatus.IN_WARRANTY` is already defined. |
| Payments | Payment records against a sale, including mixed methods. No payment field was added to `Sale` precisely to avoid constraining this. |
| Settings | Business configuration and `Location` management via API. |
| Billing | Tax-compliant invoicing, pending evaluation of local fiscal requirements. |

Known technical debt is tracked openly in [`backend-roadmap.md`](backend/docs/backend-roadmap.md).

---

## License

Released under the [MIT License](LICENSE).

---

Built by **Nezareth David Niño De la Cruz** — [GitHub](https://github.com/Nezareth07)
