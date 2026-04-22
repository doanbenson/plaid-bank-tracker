# Stitch UI Alignment Brief
Created: 2026-04-21 19:37:37 -07:00

## Problem / Outcome Summary
The web UI in apps/web should be updated to match the existing Stitch design direction and assets for the Modern Multi-Bank Hub project, using Stitch MCP as the authoritative source for design-system and screen references. The goal is visual/interaction parity with the Stitch direction while preserving existing Plaid-linked data behavior.

## Who This Matters For
- End users who need a more polished, cohesive financial dashboard experience.
- Product/design owners who want the shipped UI to reflect the Stitch project artifacts already created.
- Engineers implementing future screen variants from the same Stitch project.

## Locked Decisions
- Stitch MCP project projects/484370217401737784 is the source of truth for target UI direction.
- Existing Next.js app routes remain the integration surface (/, /transaction, /wealth, /support).
- Existing data fetching contracts in apps/web/lib/api-client.ts remain in place; this is a UI alignment effort, not an API contract rewrite.
- The local Stitch export folder under apps/web/public/stitch/modern-multi-bank-hub remains available as fallback reference material.

## Non-Goals
- No backend/domain migration or API redesign.
- No introduction of backward-compatibility shims.
- No test-authoring scope in this plan.
- No runtime dependency on exposing Stitch API keys in browser code.

## Success Criteria
- Main dashboard and nav surfaces visually align with Stitch design tokens/layout intent.
- Placeholder pages (/transaction, /wealth, /support) are upgraded from stub content to Stitch-consistent screens.
- Styling tokens in globals.css are reconciled against the tracked Stitch design-system values.
- Manual validation confirms responsive behavior and existing data-driven dashboard sections still work.

## Explicit User Constraints
- Use Stitch MCP defined in .vscode/mcp.json.
- Deliver a complete implementation plan only (no implementation in this step).
