# Stitch UI Alignment Plan
Created: 2026-04-21 19:37:37 -07:00

## Summary
Update the Next.js web UI in apps/web to align with the Stitch project Modern Multi-Bank Hub (projects/484370217401737784) and its design-system/screen references, while keeping existing Plaid/API data flows intact. The work focuses on replacing placeholder routes, refining dashboard shell/sections, and reconciling token values in globals.css to match Stitch design intent. Stitch MCP is used as design-source authority during planning and implementation decisions, but not introduced as a runtime client dependency.

## Intent / Why
- Ship the UI users already expect from the existing Stitch design work instead of keeping partially-stubbed pages and mixed visual language.
- Preserve user value in existing linked-account and transaction flows while improving clarity and consistency.
- Keep design-authoritative inputs tied to Stitch MCP project data and the locally exported references.
- Avoid leaking Stitch credentials into client runtime.

## Source Artifacts
- Brief / intent artifact: ./tmp/plan-artifacts/2026-04-21-stitch-ui-alignment-brief.md
- Research dossier: ./tmp/plan-artifacts/2026-04-21-stitch-ui-alignment-research-dossier.md

## What
Align dashboard and related pages (/transaction, /wealth, /support) to Stitch visual structure and tokens, preserving current API + Plaid integration behavior.

### Success Criteria
- [ ] Dashboard shell/navigation and primary sections match Stitch layout intent.
- [ ] Transaction, wealth, and support pages are no longer placeholder div stubs.
- [ ] Global token/radius values are reconciled with tracked Stitch design-system values.
- [ ] Existing account/transaction fetch, filtering, and Plaid-link actions remain functional.
- [ ] Desktop, tablet, and mobile layouts preserve navigability and visual hierarchy.

## Verified Repo Truths

### Data / State
- Fact: Dashboard data is loaded from accounts and transactions APIs via one fetchData function called on mount and after link success.
  Evidence: apps/web/app/page.tsx:34-58
  Implication: UI alignment must preserve this asynchronous loading/refresh behavior.

- Fact: Plaid linking is encapsulated in a dedicated component that requests link token and exchanges public token using plaidApi.
  Evidence: apps/web/components/bank/PlaidLinkButton.tsx:4-109
  Implication: Visual changes should reuse this component contract rather than re-implementing Plaid flow.

### Entry Points / Integrations
- Fact: Root layout injects SideNavbar for all app routes and applies Manrope font variable on body.
  Evidence: apps/web/app/layout.tsx:2-25
  Implication: Stitch shell alignment should be implemented through layout/nav updates, not per-page duplicated sidebars.

- Fact: Nav routes are centralized in SideNavbar with hrefs for /, /transaction, /wealth, and /support.
  Evidence: apps/web/components/bank/SideNavbar.tsx:7-11
  Implication: Route-level UI uplift should align these existing destinations instead of introducing new route patterns.

### Frontend / UI
- Fact: The three non-dashboard pages currently render placeholder content.
  Evidence: apps/web/app/transaction/page.tsx:5-5; apps/web/app/wealth/page.tsx:5-5; apps/web/app/support/page.tsx:5-5
  Implication: These routes are the highest-impact surfaces for Stitch-parity completion.

- Fact: Global theme tokens are defined in apps/web/app/globals.css with light/dark variables and gradient body background.
  Evidence: apps/web/app/globals.css:49-124
  Implication: Stitch design token reconciliation belongs in globals.css rather than ad hoc per-component hardcoding.

- Fact: Local Stitch exports include design-system JSON and two dashboard HTML references under apps/web/public/stitch/modern-multi-bank-hub.
  Evidence: apps/web/public/stitch/modern-multi-bank-hub/downloaded-assets.md:12-14; apps/web/public/stitch/modern-multi-bank-hub/design-system.json:3-18
  Implication: Implementers can map visuals from concrete local artifacts without guessing.

### Shared Types / Exports
- Fact: API contracts used by the web app are centralized in apps/web/lib/api-client.ts for plaid, accounts, and transactions endpoints.
  Evidence: apps/web/lib/api-client.ts:3-59
  Implication: UI alignment should keep existing client contract usage unchanged.

### Validation / Tooling
- Fact: Root scripts provide dev/build/start/lint orchestration and web package scripts include dev/build/start/lint.
  Evidence: package.json:8-13; apps/web/package.json:6-9
  Implication: Validation steps should use these existing scripts.

- Fact: No typecheck script exists in root or web package scripts.
  Evidence: package.json:1-15; apps/web/package.json:1-40
  Implication: Type validation should run via direct tsc command instead of npm script.
  Search Evidence: execution_subagent audit (2026-04-21) ran `Select-String -Pattern "typecheck" -Path package.json, apps/web/package.json, apps/serverless-backend/package.json` and returned no matches.

- Fact: Stitch configuration exists in .vscode/mcp.json and points to https://stitch.googleapis.com/mcp with a stitch server entry.
  Evidence: .vscode/mcp.json:3-8
  Implication: Stitch MCP-backed design verification is available in-repo for planning and manual refresh workflows.

- Fact: No Stitch/MCP runtime references are present in apps/web/app, apps/web/components, or apps/web/lib source.
  Evidence: apps/web/app/page.tsx:1-257; apps/web/components/bank/SideNavbar.tsx:1-57; apps/web/lib/api-client.ts:1-62
  Implication: Current UI does not fetch Stitch at runtime; alignment work is implementation/design translation within Next components.
  Search Evidence: execution_subagent audit (2026-04-21) ran `Select-String -Pattern "stitch", "Stitch", "mcp_stitch" -Path (Get-ChildItem -Path apps/web/app, apps/web/components, apps/web/lib -Recurse -File | Select-Object -ExpandProperty FullName)` and returned no matches.

## Locked Decisions
- Use Stitch MCP project projects/484370217401737784 as design source authority.
- Use screen `projects/484370217401737784/screens/aec705ae00244bc29ccd1f3e114ad47b` (downloaded as dashboard-reference-2.html) as primary layout authority; use dashboard-reference-1.html only for missing details.
- Keep existing route topology and data-fetch contracts; do not redesign backend APIs.
- Do not add runtime Stitch API calls or expose Stitch API credentials in client code.
- Keep local exports under apps/web/public/stitch/modern-multi-bank-hub as fallback references if MCP access is unavailable.
- Replace placeholder pages completely; no compatibility shims.
- Do not add unit or integration tests in this plan.

## Known Mismatches / Assumptions
- Mismatch: User request asks to update UI “as Stitch has it,” but Stitch project contains multiple screen instances and one DESIGN_SYSTEM_INSTANCE that does not directly map 1:1 to current route structure.
  Repo Evidence: apps/web/public/stitch/modern-multi-bank-hub/downloaded-assets.md:19-19
  Requirement Evidence: User request in this session to “update the UI as stitch has it use the stitch mcp”.
  Planning Decision: Use design-system tokens plus `screens/aec705ae00244bc29ccd1f3e114ad47b` (dashboard-reference-2.html) as baseline, and map to existing route topology (/ , /transaction, /wealth, /support).

- Mismatch: Existing globals.css token values differ from currently listed Stitch project namedColors/custom color returned from MCP.
  Repo Evidence: apps/web/app/globals.css:51-76; apps/web/public/stitch/modern-multi-bank-hub/design-system.json:11-31
  Requirement Evidence: Need Stitch-aligned UI.
  Planning Decision: Reconcile tokens explicitly in globals.css using a documented mapping table before component-level styling changes.

## Critical Codebase Anchors
- Anchor: Root app shell composition.
  Evidence: apps/web/app/layout.tsx:2-25
  Reuse / Watch for: Keep SideNavbar and body font wiring centralized.

- Anchor: Main dashboard data and grouped account rendering.
  Evidence: apps/web/app/page.tsx:34-191
  Reuse / Watch for: Preserve fetchData call pattern, selectedAccount filtering, and groupedAccounts logic.

- Anchor: Global token + theme variable definitions.
  Evidence: apps/web/app/globals.css:49-124
  Reuse / Watch for: Token-first updates, avoid one-off hardcoded color drift.

- Anchor: Navigation item source and route selection behavior.
  Evidence: apps/web/components/bank/SideNavbar.tsx:7-40
  Reuse / Watch for: Keep navItems source of truth and active route logic stable.

- Anchor: Stitch local references and design system values.
  Evidence: apps/web/public/stitch/modern-multi-bank-hub/downloaded-assets.md:3-19; apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:10-206; apps/web/public/stitch/modern-multi-bank-hub/design-system.json:3-31
  Reuse / Watch for: Treat as authoritative visual reference set for implementation decisions.

## All Needed Context

### Documentation & References
- Repo reference: apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html
  Why: Concrete desktop layout hierarchy and component spacing reference.
- Repo reference: apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-2.html
  Why: Primary desktop layout authority for shell/section structure.
- Repo reference: apps/web/public/stitch/modern-multi-bank-hub/design-system.json
  Why: Local token/radius/font values exported from Stitch artifact.
- Repo reference: .vscode/mcp.json
  Why: Stitch MCP endpoint configuration used for design-source verification.

### Token Diff Baseline
- Global token source now: apps/web/app/globals.css:51-76
- Stitch token source: apps/web/public/stitch/modern-multi-bank-hub/design-system.json:11-31
- Required mapping artifact in implementation:
  - `--background` -> `namedColors.background`
  - `--foreground` -> `namedColors.on_background`
  - `--primary` / `--primary-foreground` -> `namedColors.primary` / `namedColors.on_primary`
  - `--secondary` / `--secondary-foreground` -> `namedColors.secondary` / `namedColors.on_secondary`
  - `--accent` / `--accent-foreground` -> nearest Stitch equivalent (`tertiary_container` or `secondary_container` based on use context)
  - `--border` / `--ring` -> `namedColors.outline_variant` / `namedColors.outline`
  - `--radius` -> Stitch `roundness` (`ROUND_EIGHT` => 0.5rem baseline)

### Files Being Changed

```text
apps/web/
  app/
    globals.css                          <- MODIFIED (existing)
    layout.tsx                           <- MODIFIED (existing)
    page.tsx                             <- MODIFIED (existing)
    transaction/
      page.tsx                           <- MODIFIED (existing)
    wealth/
      page.tsx                           <- MODIFIED (existing)
    support/
      page.tsx                           <- MODIFIED (existing)
  components/
    bank/
      SideNavbar.tsx                     <- MODIFIED (existing)
      AccountCard.tsx                    <- MODIFIED (existing)
      TransactionList.tsx                <- MODIFIED (existing)
```

### Known Gotchas & Library Quirks
- Stitch design-system instance itself may not provide direct htmlCode.downloadUrl; use associated screen(s) for layout HTML and use design-system JSON/MCP payload for token values.
- Current dashboard includes static insight sections; preserve static content unless explicitly replaced with live data.
- Placeholder route pages are server components currently returning plain divs, so introducing client interactivity requires explicit client boundaries only where needed.

## Reconciliation Notes
- Added from dossier: Emphasis on preserving layout shell anchors (layout + SideNavbar) and token-first reconciliation before section-level refactoring.
- Added from dossier: Explicit warning to keep PlaidLinkButton contract untouched during UI alignment.
- Conflict resolved: Dossier identified no required external docs; final plan now relies on repo-local references only.
- Intentionally dropped: Speculative new helper/component files, deferring extraction until duplication is proven during implementation.

## Delta Design

### Data / State Changes
Existing:
- Dashboard state includes accounts, transactions, loading, and selectedAccount in apps/web/app/page.tsx.

Change:
- Keep state model and API calls unchanged.
- Move only presentational segmentation and props-shaping needed to support Stitch-aligned sections/components.

Why:
- Request is UI alignment, not domain/data redesign.

Risks:
- Unintended changes to fetch timing or selected account behavior during JSX refactor.

### Entry Point / Integration Flow
Existing:
- Shared shell from layout + SideNavbar; dashboard route is primary populated surface.

Change:
- Evolve shell visuals (header/nav/main spacing) to match Stitch references.
- Fill /transaction, /wealth, /support with real UIs that fit shared shell.

Why:
- Route topology already exists and maps cleanly to Stitch navigation concepts.

Risks:
- Inconsistent breakpoint behavior across routes if each page diverges from shared shell assumptions.

### User-Facing / Operator-Facing Surface
Existing:
- Dashboard has mixed polished + static sections; secondary pages are placeholders.

Change:
- Deliver complete Stitch-aligned surfaces for dashboard and secondary pages.
- Standardize typography hierarchy, chip/card styles, and section spacing via shared components.

Why:
- Provides coherent experience and removes obvious unfinished surfaces.

Risks:
- Over-fitting literal Stitch HTML can reduce maintainability if component boundaries are ignored.

### External / Operational Surface
Existing:
- Stitch MCP available through .vscode/mcp.json; no runtime Stitch usage in app.

Change:
- Keep Stitch as design-time source only.

Why:
- Avoid exposing MCP credentials and avoid unnecessary runtime dependencies.

Risks:
- Designers may expect live sync; must document manual refresh process for design references.

## Implementation Blueprint

### Architecture Overview
Apply a token-first then component-first migration. First reconcile global tokens/radii in globals.css from Stitch references. Next align shared shell (layout + SideNavbar) to the primary Stitch desktop screen. Then refactor dashboard sections to match Stitch hierarchy while preserving current state/data logic. Finally replace placeholder route pages with Stitch-consistent page compositions using existing shared primitives.

### Key Pseudocode
```tsx
// 1) Token reconciliation
read(stitch design-system + mcp project theme)
mapTokensToCssVars(globals.css)
verify(light/dark contrast and body background layering)

// 2) Shared shell alignment
update(layout.tsx, SideNavbar.tsx)
reuse existing route/layout composition

// 3) Dashboard structure alignment
keep(fetchData, accounts/transactions state)
update section wrappers and card/chip classes to stitch-parity styles

// 4) Placeholder route replacement
for route in [transaction, wealth, support]:
  replace stub page with structured surface using existing shadcn primitives
  reuse shared shell spacing and tokenized classes

// 5) Safety checks
run lint + build + tsc --noEmit
manual smoke: nav, plaid link button availability, account filter behavior
```

### Data Models and Structure
```ts
// Existing route-level account shape used by dashboard
// apps/web/app/page.tsx
type BankAccount = {
  account_id: string;
  name: string;
  mask?: string;
  type: string;
  subtype: string;
  balance: {
    available: number | null;
    current: number | null;
    limit: number | null;
  };
};

// Existing API hubs to preserve
// apps/web/lib/api-client.ts
export const accountsApi = { getAll, getById };
export const transactionsApi = { getAll };
export const plaidApi = { createLinkToken, exchangePublicToken, syncTransactions };
```

### Tasks (in implementation order)
Task 1:
Goal:
- Normalize design tokens to Stitch source values before JSX refactor.
Files:
- MODIFY apps/web/app/globals.css
Pattern to copy:
- apps/web/app/globals.css
Gotchas:
- Keep variable naming convention used by shadcn/Tailwind CSS variable setup.
Definition of done:
- Token diff mapping documented in implementation notes; global variables updated; app renders with reconciled palette/radius.

Task 2:
Goal:
- Align shared shell/navigation structure to Stitch references.
Files:
- MODIFY apps/web/app/layout.tsx
- MODIFY apps/web/components/bank/SideNavbar.tsx
Pattern to copy:
- apps/web/components/bank/SideNavbar.tsx
Gotchas:
- Preserve active-route logic and PlaidLinkButton placement/accessibility.
Definition of done:
- Sidebar + header + content offsets consistent across routes and breakpoints.

Task 3:
Goal:
- Bring dashboard surface to Stitch parity while preserving data behavior.
Files:
- MODIFY apps/web/app/page.tsx
- MODIFY apps/web/components/bank/AccountCard.tsx
- MODIFY apps/web/components/bank/TransactionList.tsx
Pattern to copy:
- apps/web/app/page.tsx
Gotchas:
- Do not alter fetchData behavior, selectedAccount filtering, or API endpoint usage.
Definition of done:
- Dashboard visuals align with Stitch references and existing interactions still work.

Task 4:
Goal:
- Replace route stubs with Stitch-consistent, production-ready surfaces.
Files:
- MODIFY apps/web/app/transaction/page.tsx
- MODIFY apps/web/app/wealth/page.tsx
- MODIFY apps/web/app/support/page.tsx
Pattern to copy:
- apps/web/app/page.tsx
Gotchas:
- Keep server/client component boundaries explicit and minimal.
Definition of done:
- No route returns placeholder div text; each route uses coherent styled layout.

### Integration Points
- Data / schema source of truth: apps/web/app/page.tsx local route state and apps/web/lib/api-client.ts response contracts.
- Entry points to extend: apps/web/app/layout.tsx and route pages under apps/web/app/*/page.tsx.
- Validation layer: TypeScript strict mode via apps/web/tsconfig.json and ESLint via apps/web/eslint.config.mjs.
- Domain / service layer: apps/web/lib/api-client.ts for HTTP integration.
- User-facing / operator-facing surface: apps/web/app/page.tsx plus transaction/wealth/support pages and shared bank components.
- Shared types / export hubs: component props and route-level types inside apps/web/components and apps/web/app.
- External / operational hooks: .vscode/mcp.json Stitch MCP server config and local Stitch exports in apps/web/public/stitch/modern-multi-bank-hub.

## Validation
```bash
npm run lint --workspace=web
npm run build --workspace=web
npm exec --workspace=web tsc -- --noEmit -p tsconfig.json
```

### Factuality Checks
- Every Verified Repo Truths bullet uses Fact/Evidence/Implication.
- Negative claims include search evidence from the repository audit.
- No proposal language appears in Verified Repo Truths.
- Every MODIFY path listed in this plan exists today.
- No template placeholders remain.

### Manual Checks
- Scenario: Dashboard renders with linked accounts and grouped cards after token/shell refactor.
  Expected: Account totals, account filters, and transaction list behave as before.
- Scenario: Navigate using sidebar to /transaction, /wealth, /support.
  Expected: Each route renders full UI surface (not placeholder text) with shared shell alignment.
- Scenario: Trigger Plaid link button from sidebar/dashboard empty state.
  Expected: Button remains enabled/disabled according to existing ready/loading logic.
- Scenario: Mobile and tablet navigation remains usable when sidebar is hidden below lg.
  Expected: Core page content remains accessible and route navigation remains available through implemented mobile/tablet pattern.

## Open Questions
- None.

## Final Validation Checklist
- [ ] No linting errors: npm run lint --workspace=web
- [ ] Build succeeds: npm run build --workspace=web
- [ ] No type errors: npm exec --workspace=web tsc -- --noEmit -p tsconfig.json
- [ ] Error cases handled gracefully
- [ ] Verified Repo Truths contains only checked facts
- [ ] Every verified fact includes exact evidence
- [ ] Every negative claim includes search evidence
- [ ] No proposal language appears in Verified Repo Truths
- [ ] Every MODIFY path exists in the repo
- [ ] No template/example placeholders remain
- [ ] High-value anchors/docs/gotchas from dossier reconciled or intentionally dropped
- [ ] Any plan-vs-dossier factual conflicts resolved or surfaced explicitly
- [ ] Entry points and integration points match current repo structure
- [ ] No unresolved factual blockers remain from review

## Deprecated / Removed Code
- Remove placeholder route markup currently returning only <div>page</div> from:
  - apps/web/app/transaction/page.tsx
  - apps/web/app/wealth/page.tsx
  - apps/web/app/support/page.tsx
- Remove any dashboard-only one-off class fragments replaced by shared Stitch-aligned components during refactor.

## Anti-Patterns to Avoid
- Do not hardcode new color values in scattered component classes when globals.css token variables can express them.
- Do not duplicate sidebar/header markup across pages; keep shell in shared layout/components.
- Do not change API endpoint contracts or Plaid flow while doing visual alignment.
- Do not attempt runtime Stitch API fetching in browser/client bundles.

## Confidence
8/10
