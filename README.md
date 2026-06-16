# CarePath AI

Trusted healthcare referrals for India.

> Where should a patient go, **and can we trust why it was recommended?**

## Problem

Healthcare facility data is noisy, incomplete, and inconsistent. Traditional
referral systems recommend facilities without explaining why they were selected
or whether the underlying information can be trusted.

Planners need decision support, not another chatbot.

## Solution

CarePath AI is a **Referral Copilot** with built-in **Facility Trust
management**. It does not just answer *"where should a patient go?"* — it shows
*why* a facility was recommended and how much the underlying information can be
trusted, with the source text cited for every claim.

### What "trust" means here (and what it does not)

The dataset contains **no clinical outcomes, ratings, or accreditation** — so
CarePath AI does **not** claim a facility is clinically good. Instead it scores
**information trust**: how complete, internally consistent, recently updated, and
cross-source corroborated a facility's record is. A high-fit facility built on a
thin, stale, single-source record is flagged, not hidden.

## Features

- **Referral Engine** — retrieves and ranks facilities by clinical fit
  (specialty match) and proximity to the patient.
- **Trust Engine** — computes a transparent *information-trust* score per
  facility from completeness, source corroboration, recency, and presence
  signals, with a component-by-component breakdown.
- **Evidence Engine** — cites the exact facility text and source URLs used for
  every recommendation; the explanation is grounded strictly in stored text.
- **Uncertainty Engine** — communicates confidence honestly using per-facility
  data completeness and district-level health context (NFHS-5), instead of
  presenting uncertain information as fact.
- **Coverage Insights (AI/BI)** — a population-health view that flips the app
  from per-patient lookup to *where to prioritize*. A **Care Gap Index** ranks
  districts by a transparent blend of NFHS-5 **need**, facility **supply
  scarcity**, and an information-**trust deficit**, and an **"Ask the data"**
  copilot answers natural-language questions about coverage and trust — via
  Databricks AI/BI **Genie** when configured, or a grounded guided-analyst mode
  otherwise. Every chart carries an honest data-confidence footer.
- **Planner Workspace** — planners save notes, shortlists, and overrides.

## Workflow

1. **Patient Need** — condition/specialty, patient location, constraints.
2. **Candidate Retrieval** — filter by geography (distance) + specialty.
3. **Fit Ranking** — rank candidates by specialty fit and proximity.
4. **Trust Scoring** — score information trust; shown alongside fit and able to
   re-rank/break ties (weighting is visible and adjustable).
5. **Evidence Inspection** — cite exact source text and URLs per claim.
6. **Context & Uncertainty** — completeness-based confidence band + NFHS-5
   district context.
7. **Planner Decisions** — shortlist, notes, and overrides (persisted).

## Data

Source catalog (read-only, Delta Sharing):
`databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset`

| Table | Rows | Role |
|---|---|---|
| `facilities` | ~10,088 (≈10k in India) | Core facility records (specialty, address, contact, geo, trust signals). All columns typed `string` → require parsing. |
| `india_post_pincode_directory` | 165,627 | Pincode → district/state + lat/long; geography join. |
| `nfhs_5_district_health_indicators` | 706 | District health context (~110 indicators) for the Uncertainty Engine. |

Derived/cleaned tables are written to **`workspace.carepath_ai`** (the source
catalog is read-only).

## Architecture

- **Data layer (Delta)** — clean `facilities` (drop dirty rows, parse + dedup
  `specialties`, validate lat/long, normalize address), geo-enrich via pincode,
  and precompute trust features.
- **Referral + Trust layer** — distance + specialty retrieval, fit score, and a
  transparent blended fit/trust ranking.
- **LLM layer** — Databricks Foundation Model APIs (Claude by default,
  swappable) for plain-language → specialty mapping and *grounded* explanations
  that cite only stored facility text.
- **App layer** — a Databricks App (Planner Workspace) over the layers above.

## Execution Plan

- ✅ **Phase 0 — Foundations:** `workspace.carepath_ai`; `facilities_silver`
  (cleaned/parsed) and `facility_trust` (`trust_score` + component breakdown + flags).
- ✅ **Phase 1 — Referral + Trust core:** retrieval (`km_between` haversine +
  specialty), fit score, and transparent blended ranking
  (`recommend_facilities`, `recommend_by_pincode`).
- ✅ **Phase 2 — Grounded LLM:** cited "why recommended" explanations grounded
  strictly in the stored facility record, with an AI-generated disclaimer.
- ✅ **Phase 3a — App:** Databricks App (AppKit) with need input → ranked cards
  (fit + trust + distance) → facility detail (trust breakdown, evidence, NFHS context).
- ⬜ **Phase 3b — Planner Workspace persistence:** shortlists/notes/overrides
  (Lakebase). Deferred.

## Project layout

- `sql/` — the data + logic layer (run in order against the `carepath-ai`
  workspace): `00_schema`, `01_facilities_silver`, `02_facility_trust`,
  `03_referral_engine`, `04_care_gap_index` (district Care Gap Index view for
  the AI/BI Insights console).
- `app/carepath-ai/` — the Databricks App (AppKit React + analytics + serving).

## Running & deploying

Local dev (needs the `databricks` CLI on PATH, profile `carepath-ai`):

```
cd app/carepath-ai
npm run dev          # http://localhost:8000
```

Deploy to the workspace:

```
cd app/carepath-ai
databricks apps deploy --profile carepath-ai
```

**Required once:** the app's service principal must be able to read the data.
Grant it `USE CATALOG`/`USE SCHEMA`/`SELECT` on
`databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset` and
`USE CATALOG`/`USE SCHEMA`/`SELECT`/`EXECUTE` on `workspace.carepath_ai`
(otherwise build-time type generation and runtime queries fail with
`INSUFFICIENT_PERMISSIONS`).

**AI/BI Insights:** the Insights tab works out of the box (it falls back to
bundled sample data if the warehouse isn't reachable). For live numbers, run
`sql/04_care_gap_index.sql` once in the workspace. To enable the **Live Genie**
tab, set `DATABRICKS_GENIE_SPACE_ID` on the app (server) and
`VITE_GENIE_ENABLED=true` for the client build; without them the copilot runs in
grounded guided-analyst mode using the existing serving endpoint.

Live app: https://carepath-ai-7474660235866912.aws.databricksapps.com

## Technology

- Databricks (Unity Catalog, Delta, SQL Warehouse)
- Databricks Apps (AppKit — React/TypeScript)
- Databricks Foundation Model APIs (`databricks-meta-llama-3-3-70b-instruct`; swappable)
- TypeScript / SQL

## What This Project Is For

CarePath AI is designed for planners and referral teams who need transparent,
evidence-backed facility recommendations — with an honest signal of how much the
underlying information can be trusted — rather than generic AI responses.
