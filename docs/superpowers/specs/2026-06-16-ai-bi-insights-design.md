# CarePath Insights — AI/BI Coverage Intelligence (Design)

**Date:** 2026-06-16
**Branch:** `feat/ai-bi-insights`
**Hackathon:** Databricks "Apps & Agents for Good" 2026 — AI/BI slice
**Goal:** Add a creative, demo-safe AI/BI layer to CarePath AI without disturbing the existing Referral Workspace.

## Why this wins

Judging criteria → how this maps:

| Criterion | How Insights delivers |
|---|---|
| **Product Judgment** | Extends the app from *per-patient referral* to *population-health prioritization*. Clear user: a regional health planner / NGO allocator. |
| **Evidence & Uncertainty** | Genie answers show the **SQL they ran**; every chart carries a **data-confidence footer** (share of high-trust vs flagged facilities). The BI is honest about its own reliability. |
| **Technical Execution** | Real Databricks **AI/BI Genie** (`GenieChat`) + AppKit charts + a new SQL view, with graceful fallbacks so it never breaks in a live demo. |
| **Ambition** | The **Care Gap Index** is a net-new analytical artifact combining supply, NFHS-5 need, and trust deficit. |

## Scope (approved: all 3 pillars)

### Pillar 1 — Care Gap Index (flagship)
A district-level score answering *"where should scarce care resources go?"* combining:
- **Supply** — facility count, total capacity/doctors, per-capita-ish density, specialty breadth.
- **Need** — NFHS-5 indicators (anaemia, low institutional births, low skilled-birth attendance, low insurance coverage). Higher deprivation → higher need.
- **Trust deficit** — share of a district's facilities flagged low-trust / stale / single-source.

`care_gap_score` (0–100, higher = bigger gap) = weighted blend, normalized across districts.
Stored as a new data-layer view `workspace.carepath_ai.care_gap_index` (`sql/04_care_gap_index.sql`), surfaced via a `config/queries/care_gap.sql` analytics query. Rendered as a ranked bar chart + a district table/drill-down.

### Pillar 2 — "Ask the Data" Genie copilot
Embedded `GenieChat` (alias `insights`) over facilities/trust/NFHS. Natural-language question → answer + generated SQL + auto-chart.
**Demo-safe fallback:** the `genie()` server plugin is registered **only when `DATABRICKS_GENIE_SPACE_ID` is set**. When absent, the UI shows a **Guided Insights** mode: a curated set of questions, each mapped to a precomputed analytics query + chart + a grounded one-paragraph narrative from the existing `serving()` model. The panel always works on stage.

### Pillar 3 — Honest-uncertainty BI
A reusable `<DataConfidence>` footer component shown under each insight chart: "Based on N facilities — X% high-trust, Y% flagged. NFHS-5 coverage: Z districts." Mirrors the app's core trust thesis.

## Architecture (additive only)

```
client/src/
  App.tsx                      # + top-nav: Referrals | Insights (react-router already a dep)
  pages/
    ReferralWorkspace.tsx      # UNCHANGED
    InsightsConsole.tsx        # NEW — Care Gap + Genie/Guided + confidence
  components/
    CareGapPanel.tsx           # NEW — ranked districts bar chart + table
    AskTheData.tsx             # NEW — GenieChat when available, else Guided mode
    DataConfidence.tsx         # NEW — reusable confidence footer
  lib/insights.ts              # NEW — guided-question catalog + helpers
config/queries/
  care_gap.sql                 # NEW — reads care_gap_index view (+ params)
  care_gap_district.sql        # NEW — single-district drilldown
  data_confidence.sql          # NEW — trust composition for footers
sql/
  04_care_gap_index.sql        # NEW — care_gap_index view in workspace.carepath_ai
server/server.ts               # + conditional genie() plugin (env-gated)
client/src/data/insights-sample.json  # NEW — bundled sample for offline/no-warehouse fallback
```

**Routing:** App already depends on `react-router`. Introduce a minimal two-route layout (Referrals `/`, Insights `/insights`) or a lightweight in-page tab switch (no router) to keep the change small. **Decision: in-page tab state** — zero routing risk, smallest blast radius, still demoable.

**Charts:** Use `BarChart` from `@databricks/appkit-ui/react` with `{ queryKey, parameters }` when the warehouse is live, falling back to `{ data }` from `insights-sample.json` when an analytics query errors/returns empty.

**Genie server config:**
```ts
import { createApp, analytics, serving, server, genie } from '@databricks/appkit';
const plugins = [analytics(), serving(), server()];
if (process.env.DATABRICKS_GENIE_SPACE_ID) {
  plugins.push(genie({ spaces: { insights: process.env.DATABRICKS_GENIE_SPACE_ID } }));
}
createApp({ plugins }).catch(console.error);
```

## Care Gap SQL sketch (`sql/04_care_gap_index.sql`)

```sql
CREATE OR REPLACE VIEW workspace.carepath_ai.care_gap_index AS
WITH supply AS (
  SELECT district, state,
         COUNT(*)                                   AS n_facilities,
         SUM(COALESCE(capacity,0))                  AS total_beds,
         SUM(COALESCE(number_doctors,0))            AS total_doctors,
         AVG(t.trust_score)                         AS avg_trust,
         AVG(CASE WHEN t.trust_tier='Low' OR SIZE(t.trust_flags)>0 THEN 1.0 ELSE 0 END) AS flagged_share
  FROM workspace.carepath_ai.facilities_silver s
  JOIN workspace.carepath_ai.facility_trust t USING (facility_id)
  WHERE s.district IS NOT NULL AND TRIM(s.district) <> ''
  GROUP BY district, state
),
need AS (
  SELECT UPPER(TRIM(district_name)) AS dkey,
         all_w15_49_who_are_anaemic_pct                    AS anaemia,
         100 - institutional_birth_5y_pct                  AS non_institutional_births,
         100 - births_attended_by_skilled_hp_5y_10_pct     AS unskilled_births,
         100 - hh_member_covered_health_insurance_pct      AS uninsured
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.nfhs_5_district_health_indicators
)
-- normalize each component 0..100 across districts (PERCENT_RANK), then blend:
-- care_gap = 0.45*need + 0.35*(supply scarcity) + 0.20*trust_deficit
SELECT ... ;  -- full impl in file
```

Need-side uses outer joins so districts without an NFHS match still appear (with a `need_known` flag feeding the confidence footer).

## Demo-safe guarantees (the "nothing breaks" contract)

1. **Boots without Genie** — plugin only registered when env var present.
2. **Renders without a warehouse** — each panel catches query errors and falls back to bundled sample JSON, with a visible "sample data" badge.
3. **Existing Referral Workspace untouched** — new files + one nav addition only.
4. **Typecheck/lint/build clean** — `npm run typecheck`, `npm run lint`, `npm run build` must pass on the branch.
5. **Care Gap view is idempotent** — `CREATE OR REPLACE VIEW`; run once in the workspace, no rebuild of base tables.

## Out of scope (YAGNI)
- Lakebase persistence of saved insights (Phase 3b is already deferred upstream).
- A full agentic multi-tool flow — Genie already provides the agentic NL→SQL behavior.
- Map/geo visualizations — district bar charts are enough for a 3-min demo.

## Verification
- `cd app/carepath-ai && npm run typecheck && npm run lint && npm run build` pass.
- Manual: Insights tab renders Care Gap chart + Ask-the-Data panel from sample data with no warehouse; nav back to Referrals works unchanged.
- (When workspace auth available) run `sql/04_care_gap_index.sql`, set `DATABRICKS_GENIE_SPACE_ID`, confirm live Genie + live charts.
