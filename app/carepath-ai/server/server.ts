import { createApp, analytics, serving, server, genie } from '@databricks/appkit';
// The agents plugin is beta and ships from the /beta entry point.
import { agents } from '@databricks/appkit/beta';
import pg from 'pg';
import { initPlannerSchema, registerPlannerRoutes } from './routes/planner';

// Lakebase (Postgres) — persists Planner Workspace state (shortlists, notes,
// overrides). The installed CLI binds classic Lakebase instances, which the
// AppKit lakebase plugin (built for Lakebase Autoscaling) doesn't support, so we
// connect with native Postgres password auth via a plain pg.Pool. Credentials
// come from PG* env (see app.yaml). When PGHOST is absent the app still runs
// fully — only "Save to shortlist" persistence is unavailable.
const lakebaseEnabled = Boolean(process.env.PGHOST);

const pool = lakebaseEnabled
  ? new pg.Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'databricks_postgres',
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false },
    })
  : null;

// AI/BI Genie is optional and env-gated so the app boots cleanly even when no
// Genie space is wired yet. Set DATABRICKS_GENIE_SPACE_ID (and, on the client,
// VITE_GENIE_ENABLED=true) to light up the "Live Genie" tab in Insights.
await createApp({
  plugins: [
    analytics(),
    serving(),
    // Agent Bricks — referral copilot. Loads config/agents/referral/agent.md,
    // which scopes the analytics plugin's read-only SQL tool. Requires a
    // streaming-capable serving endpoint (the llama Foundation Model API is).
    agents(),
    server(),
    ...(process.env.DATABRICKS_GENIE_SPACE_ID
      ? [genie({ spaces: { insights: process.env.DATABRICKS_GENIE_SPACE_ID } })]
      : []),
  ],
  // Create the schema on startup (idempotent) and mount the Planner Workspace
  // CRUD routes on the Express app before it starts listening.
  async onPluginsReady(appkit) {
    if (!pool) {
      console.warn(
        '[carepath-ai] Lakebase not configured (no PGHOST) — ' +
          'shortlist persistence disabled; all other features active.',
      );
      return;
    }
    try {
      await initPlannerSchema(pool);
      appkit.server.extend((app) => {
        registerPlannerRoutes(app, pool);
      });
      console.log('[carepath-ai] Lakebase (native pg) connected — shortlist persistence active.');
    } catch (err) {
      console.error('[carepath-ai] Lakebase init failed — shortlist disabled:', err);
    }
  },
}).catch(console.error);
