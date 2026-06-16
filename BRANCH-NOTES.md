# Branch notes — `feat/lakebase-persistence-and-agent`

What this branch adds, its current state, and what to do next. Written for the team.

## Why this branch exists

The hackathon **requires Lakebase, Agent Bricks, and Databricks Apps**. The app
already used Databricks Apps but was **not using Lakebase or Agent Bricks at all**.
This branch adds both.

## The two new features

### 1. "Save to shortlist" — persistence on **Lakebase**
The app was read-only: a planner searched and that was it, nothing was remembered.
Added a **Save** button on each facility so a planner's shortlist (with notes /
manual rank overrides) **persists** in a Lakebase Postgres database across sessions.

- Backend: `app/carepath-ai/server/routes/planner.ts` — `/api/shortlist` GET/POST/DELETE,
  schema created on startup (`initPlannerSchema`), rows keyed by app-user identity.
- Frontend: `client/src/lib/shortlist.ts` (`useShortlist` hook) + Save button in
  `client/src/pages/ReferralWorkspace.tsx`.

### 2. Referral copilot — **Agent Bricks**
The AI used to be a single "summarize" button. Added a real **agent**: type a need
in plain English → it maps to a specialty, calls the existing `recommend_by_pincode`
SQL function as a tool, pulls evidence, and explains the top options with honest
trust caveats.

- Config: `app/carepath-ai/config/agents/referral/agent.md`
- Server: `server.ts` registers `agents()` (from `@databricks/appkit/beta`).
- HTTP surface: `POST /invocations`, `POST /responses`, `POST /api/agents/chat`.
- Front-end: **"AI copilot" tab** in the Referral Workspace
  (`client/src/components/AgentCopilot.tsx`) — free-text box that streams the
  agent's answer (via `useAgentChat`), shows which tools it called, and renders
  the disclaimer.

## Current working state (verified on Free Edition, 2026-06-16)

Running locally (`npm run dev`) against a **Databricks Free Edition** workspace
(`dbc-9ca5949c-d877`), with the **Virtue Foundation Dataset (DAIS 2026)** added
from Marketplace and `sql/00`–`03` run to build `workspace.carepath_ai`:

| Piece | Status |
|---|---|
| Core app (ranking + trust + evidence) | ✅ works with real data (10,000 facilities) |
| "Explain" button (serving) | ✅ works (`databricks-llama-4-maverick`) |
| **Agent** (referral copilot) | ✅ works in the "AI copilot" tab + API (`databricks-qwen3-next-80b-a3b-instruct`) |
| **Shortlist** (Lakebase) | ✅ works — saves/reads from a Lakebase instance |

## ⚠️ Free-Edition-specific TEMP changes (must revisit for the real workspace)

All marked `TEMP(free-edition)` in the code. These were needed only to run on Free
Edition and should be reviewed before deploying to a production/team workspace:

- **`databricks.yml`** — host/warehouse pointed at Free Edition; serving endpoint set
  to `databricks-llama-4-maverick`; the `postgres` (Lakebase Autoscaling) resource
  is **commented out** (Free Edition uses a classic *instance* instead — see below).
- **`app.yaml`** — `LAKEBASE_ENDPOINT` commented out.
- **`server.ts`** — Lakebase is gated behind `LAKEBASE_ENABLED` and connects via
  **native Postgres password auth** (`pool: { password }`) instead of the OAuth /
  `LAKEBASE_ENDPOINT` path the AppKit plugin normally uses.
- **`config/agents/referral/agent.md`** — `endpoint` set to a Free-Edition model.
- **`.env`** (gitignored) — local connection values + a short-lived DB token.

### Why two different Lakebase wirings?
The AppKit Lakebase plugin (v0.38.1) is built for **Lakebase Autoscaling**
(projects/branches/endpoints, `LAKEBASE_ENDPOINT`). Free Edition / this CLI exposes
the older **classic Lakebase instance** model instead. The classic instance is
reachable via standard Postgres auth, so we connect with native password auth.

## Free Edition gotchas (good to know)

- **Models**: Claude Opus 4.8 and Gemini are *listed* but blocked (rate limit 0).
  Usable ones: `llama-4-maverick`, `gpt-oss-120b/20b`, `qwen3-next-80b`.
  - For the **agent**, only `qwen3-next-80b` gave clean output: llama-4 returns
    parallel tool calls (rejected by the adapter); gpt-oss returns empty text
    (harmony channel not extracted).
- **DB token expires ~1 hour.** When the shortlist starts returning auth errors,
  regenerate `PGPASSWORD` in `.env`:
  ```
  databricks database generate-database-credential -p carepath-ai \
    --json '{"instance_names":["carepath-lakebase"],"request_id":"<any-uuid>"}'
  ```
  (For a stable demo, set a permanent Postgres password on the instance in the
  Lakebase UI instead of using the token.)
- **Serverless warehouse auto-stops** when idle — the first query after a pause
  cold-starts (a few seconds of loading skeletons), then it's fast.

## How to run it locally

```
cd app/carepath-ai
$env:DATABRICKS_CONFIG_PROFILE="carepath-ai"   # PowerShell
npm run dev          # http://localhost:8000
```
(`.env` already has the Free Edition values. Refresh `PGPASSWORD` if the shortlist 401s.)

## What's left / next steps

1. ✅ **Agent UI** — done. "AI copilot" tab in the Referral Workspace.
2. **Pick the demo workspace and lock model choices.** If demoing on Free Edition,
   keep qwen3 for the agent and llama-4-maverick for Explain. If on a workspace with
   Claude, switch back.
3. **Production Lakebase**: on a workspace with Lakebase **Autoscaling**, revert the
   `TEMP(free-edition)` Lakebase bits — re-enable the `postgres` resource in
   `databricks.yml` + `LAKEBASE_ENDPOINT`, and drop the native-password wiring in
   `server.ts` (the plugin will use OAuth automatically). Deploy once so the service
   principal creates the schema.
4. **Stable demo credential** — replace the 1-hour token with a permanent Postgres
   password if demoing from Free Edition.

## Environment actions taken (not in git)

- Added Marketplace dataset **Virtue Foundation Dataset (DAIS 2026)** as catalog
  `databricks_virtue_foundation_dataset_dais_2026`.
- Ran `sql/00`–`03` to build `workspace.carepath_ai` (facilities_silver, facility_trust,
  pincode_geo, recommend functions).
- Created a Lakebase instance **`carepath-lakebase`** (capacity CU_1).
