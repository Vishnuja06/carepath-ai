import { createApp, analytics, serving, lakebase, agents, server } from '@databricks/appkit';
import { registerPlannerRoutes } from './routes/planner';

createApp({
  plugins: [
    analytics(),
    serving(),
    // Lakebase (Postgres) — persists Planner Workspace state (shortlists,
    // notes, overrides). Plugin key per appkit.plugins.json is `lakebase`.
    lakebase(),
    // Agent Bricks — referral copilot that maps free-text need -> specialty,
    // calls the `recommend` query/TVF as a tool, and synthesizes grounded,
    // cited explanations. Auto-discovers tools from the analytics plugin.
    // Agent config lives in config/agents/referral.md.
    agents(),
    server(),
  ],
  // Mount the Planner Workspace CRUD routes on the Express app. AppKit exposes
  // the Express instance to this hook; confirm the exact hook name
  // (`onServerReady` / `configureServer`) against node_modules/@databricks/appkit/CLAUDE.md.
  onServerReady: (app) => {
    registerPlannerRoutes(app);
  },
}).catch(console.error);
