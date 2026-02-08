# Operator Dashboard Testing Strategy

## Goal
Validate that the operator dashboard is reliable, role-safe, and actionable for daily use.

## Scope
In scope:
- Operator dashboard navigation and tab rendering
- Operator APIs under `/operator/*`
- Personal daily briefing data contract
- Personal health, onboarding progress, and pick error views
- Role-aware access from the main app shell

Out of scope:
- Supervisor dashboard feature changes
- Model quality benchmarking for long-horizon prompt tuning

## Test Pyramid
1. Unit tests (fast, required on every change)
- Route contract tests for `/operator/briefing`, `/operator/health`, `/operator/weaknesses`, `/operator/onboarding`, `/operator/errors`, `/operator/errors/trends`
- Error-state behavior (empty data defaults, non-200 handling)
- UI tab switch behavior and empty/loading states (next increment)

2. Integration tests (required before merge)
- Authenticated user flow through app shell to operator dashboard
- DB-backed responses from `/operator/*` for seeded operator users
- Role checks:
  - operator can access `/operator/*`
  - non-supervisor denied from supervisor-only endpoints

3. E2E smoke tests (required before release)
- Login as operator -> open dashboard -> each tab loads without runtime errors
- Briefing refresh works
- Modules tab shows progress rows or expected empty state
- Pick errors trend + recent table render correctly with and without data

## Critical Journeys and Assertions
1. Operator opens dashboard
- `Operator Dashboard` CTA is visible after login
- Route/mode transition renders tab shell and no console/runtime exceptions

2. Daily Briefing
- Metrics cards render with valid values
- AI insight blocks render when present
- Graceful fallback if insights are missing

3. My Health
- Health badge maps correctly to `healthy|needs_attention|at_risk|unknown`
- Weakness sections render conditionally by type
- Last activity text handles null safely

4. Modules
- Completed/active/stalled counts are accurate from `/operator/onboarding`
- Progress bar percentage and numerator/denominator match response
- Empty state offers onboarding action

5. Pick Errors
- Summary cards match `/operator/errors.summary`
- Trend chart consumes `/operator/errors/trends`
- Empty state shown when total errors is 0
- Recent errors table matches response rows

## Data Strategy
- Seed one operator per scenario:
  - new operator (no onboarding/errors)
  - active operator (mixed module statuses)
  - at-risk operator (stalled modules + quiz failures)
- Keep deterministic fixtures for trends and top items
- Clean test records after each suite

## Execution Gates
Local gate (developer):
1. `npm --prefix client run build`
2. `npm run test:unit`

Pre-merge gate (CI):
1. `npm --prefix client run build`
2. `npm run test:unit`
3. `npm run test:integration`

Release gate:
1. Full pre-merge gate
2. `npm run test:e2e`
3. Manual role-check smoke in staging

## Pass Criteria
A change passes when:
- Build succeeds
- Required automated suite(s) for the gate are green
- No new critical/high regressions in operator journeys
- Empty/error states remain usable

## Reporting
For each PR touching operator dashboard, report:
- Commands run
- Pass/fail status per gate
- Any skipped tests and reason
- Known residual risks
