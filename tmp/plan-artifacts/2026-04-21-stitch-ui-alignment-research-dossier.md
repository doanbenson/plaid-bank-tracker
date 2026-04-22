# PRP Research Dossier: Update UI to Stitch (Stitch MCP)

## Scope
- Feature target: align apps/web UI to Stitch project projects/484370217401737784 using Stitch MCP outputs and local exports at apps/web/public/stitch/modern-multi-bank-hub.
- This is supporting research only, not the implementation plan.

## Critical Codebase Anchors

### Facts
- App shell always renders the left nav from the root layout, so dashboard-style offset spacing is currently a load-bearing assumption. Evidence: apps/web/app/layout.tsx:3-3, apps/web/app/layout.tsx:23-25, apps/web/app/page.tsx:98-98, apps/web/app/page.tsx:113-113.
- Dashboard is data-driven from existing APIs and already composes account grouping plus transaction filtering by selected account. Evidence: apps/web/app/page.tsx:38-39, apps/web/app/page.tsx:65-66, apps/web/app/page.tsx:81-91, apps/web/app/page.tsx:150-177, apps/web/app/page.tsx:180-191.
- Global tokenized styling already exists in Tailwind v4 CSS variables and matches Stitch palette direction (light background, rose/plum primaries). Evidence: apps/web/app/globals.css:6-46, apps/web/app/globals.css:50-83.
- Stitch export includes a concrete design system and HTML references for the same project. Evidence: apps/web/public/stitch/modern-multi-bank-hub/downloaded-assets.md:3-4, apps/web/public/stitch/modern-multi-bank-hub/design-system.json:3-18, apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:10-15.
- Secondary routes are currently placeholders and are prime surface area for Stitch-parity uplift. Evidence: apps/web/app/transaction/page.tsx:3-5, apps/web/app/wealth/page.tsx:3-5, apps/web/app/support/page.tsx:3-5.

### Proposals
- Keep anchors open while implementing: root layout/nav, dashboard composition, globals token map, Stitch design-system JSON, and both Stitch dashboard HTML references.

## Patterns to Reuse

### Facts
- Navigation pattern is centralized in one nav-items array with pathname-based active detection and router push. Evidence: apps/web/components/bank/SideNavbar.tsx:7-11, apps/web/components/bank/SideNavbar.tsx:16-19, apps/web/components/bank/SideNavbar.tsx:32-35.
- Existing financial card/list primitives are already extracted into reusable components, not inlined markup. Evidence: apps/web/app/page.tsx:5-7, apps/web/app/page.tsx:166-176, apps/web/app/page.tsx:180-191, apps/web/components/bank/AccountCard.tsx:22-88, apps/web/components/bank/TransactionList.tsx:25-107.
- Plaid linking is already encapsulated and reused in both nav and empty state; preserve this contract. Evidence: apps/web/components/bank/PlaidLinkButton.tsx:31-31, apps/web/components/bank/PlaidLinkButton.tsx:60-60, apps/web/components/bank/PlaidLinkButton.tsx:106-106, apps/web/components/bank/SideNavbar.tsx:51-54, apps/web/app/page.tsx:134-134.
- API access is centralized in one axios client with stable route contracts used by the UI. Evidence: apps/web/lib/api-client.ts:3-9, apps/web/lib/api-client.ts:15-15, apps/web/lib/api-client.ts:42-42, apps/web/lib/api-client.ts:59-59.

### Proposals
- Prefer translating Stitch HTML into current component boundaries (SideNavbar, AccountCard, TransactionList, page sections) rather than pasting raw HTML into route files.

## Gotchas and Load-Bearing Constraints

### Facts
- Stitch design system asset is an instance and does not provide direct htmlCode.downloadUrl like regular screens, so token-first mapping is required. Evidence: apps/web/public/stitch/modern-multi-bank-hub/downloaded-assets.md:19-19.
- Manrope is the explicit typography choice in both app shell and Stitch exports, reducing font mismatch risk if preserved. Evidence: apps/web/app/layout.tsx:2-10, apps/web/public/stitch/modern-multi-bank-hub/design-system.json:6-8, apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:75-78.
- Current dashboard includes extra sections not guaranteed by data contracts (cash-flow/intelligence cards are static text), so visual parity updates must not imply backend availability. Evidence: apps/web/app/page.tsx:198-239.
- App stack is Next 16 + React 19 + Tailwind 4 + shadcn config with CSS variables, so implementation should stay in this styling/runtime model. Evidence: apps/web/package.json:22-23, apps/web/package.json:37-38, apps/web/components.json:3-4, apps/web/components.json:8-10.

### Proposals
- Treat Stitch HTML as layout reference only; map colors/radii/type into globals.css variables first, then tune component classnames.
- Preserve existing API and Plaid interaction behavior while swapping UI structure and styling.

## Useful External Docs (Only Material)
- None required for initial implementation shaping; repository artifacts already provide design-system tokens, reference HTML, and active UI integration points.

## Suggested Implementation Shape

### Facts informing shape
- Dashboard and nav labels already overlap Stitch language (Total Net Liquidity, Connected Institutions, Dashboard/Transactions/Wealth/Support), reducing copy churn. Evidence: apps/web/app/page.tsx:117-117, apps/web/app/page.tsx:142-142, apps/web/components/bank/SideNavbar.tsx:8-11, apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:173-173, apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:206-206.
- Stitch reference structure mirrors current app shell: fixed left aside, fixed top header, main canvas with grouped institutions and right-side insights. Evidence: apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:102-102, apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:142-142, apps/web/public/stitch/modern-multi-bank-hub/dashboard-reference-1.html:205-206.

### Proposal
1. Reconcile tokens first: align globals.css variables/radius scale to design-system.json namedColors and roundness.
2. Update shared shell next: refine SideNavbar and dashboard header/main spacing to mirror Stitch structure.
3. Refactor dashboard sections by mapping Stitch section hierarchy into existing components while keeping API state logic intact.
4. Replace route stubs with Stitch-consistent transaction/wealth/support screens using current shell and token system.

## Likely File Changes (Existing vs New)

### Existing files likely to modify
- apps/web/app/globals.css
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/components/bank/SideNavbar.tsx
- apps/web/components/bank/AccountCard.tsx
- apps/web/components/bank/TransactionList.tsx
- apps/web/app/transaction/page.tsx
- apps/web/app/wealth/page.tsx
- apps/web/app/support/page.tsx

### New files likely (if needed)
- apps/web/components/bank/TopHeader.tsx
- apps/web/components/bank/InsightPanel.tsx
- apps/web/lib/stitch-token-map.ts

Notes on new files:
- New file names are proposals only, chosen to preserve current folder conventions and reduce page-level JSX bloat.
