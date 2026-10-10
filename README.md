# YolYolakay · Web

A multilingual ride-sharing and parcel delivery frontend for finding trips, managing bookings and coordinating deliveries.

**Stack:** Next.js · React · TypeScript · Zustand · TanStack Query · React Hook Form · Zod

## Features

- Trip search and driver/passenger account flows.
- Parcel, billing, vehicle and support feature modules.
- Locale-based routing and translated interface messages.
- API integration, shared state and form validation.

## Local setup

Node.js and pnpm; access to a compatible YolYolakay backend for connected flows.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# Configure backend endpoints and optional integrations locally.
pnpm dev
```

## Validation commands

```bash
pnpm lint
pnpm build
pnpm test:e2e
```

These are reproducible commands, not a claim that the full application suite passed during portfolio preparation. See the workspace validation report for checks actually run.

## Structure

```text
src/app/         routing, layouts and locale pages
src/features/    product feature modules
src/shared/      shared UI, data and utilities
messages/        translations
tests/e2e/       browser tests
```

## Limitations and configuration

The frontend is provided without backend services or production credentials. The snapshot excludes internal backend correspondence, deployment settings and generated output. End-to-end tests require the appropriate runtime configuration.

## Further documentation

[Original project documentation](docs/ORIGINAL_README.md) is preserved for implementation details and original context.
