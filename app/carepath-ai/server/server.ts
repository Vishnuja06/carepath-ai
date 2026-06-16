import { createApp, analytics, serving, lakebase, server } from '@databricks/appkit';
// The agents plugin is beta and ships from the /beta entry point.
import { agents } from '@databricks/appkit/beta';
import { initPlannerSchema, registerPlannerRoutes } from './routes/planner';

await createApp({
  plugins: [
    analytics(),
    serving(),
    // Lakebase (Postgres) — persists Planner Workspace state (shortlists,
    // notes, overrides). Exposed at runtime as appkit.lakebase.
    lakebase(),
    // Agent Bricks — referral copilot. Loads config/agents/referral/agent.md,
    // which scopes the analytics plugin's read-only SQL tool. Requires a
    // streaming-capable serving endpoint (the llama Foundation Model API is).
    agents(),
    server(),
  ],
  // Create the schema on startup (idempotent) and mount the Planner Workspace
  // CRUD routes on the Express app before it starts listening.
  async onPluginsReady(appkit) {
    await initPlannerSchema(appkit.lakebase);
    appkit.server.extend((app) => {
      registerPlannerRoutes(app, appkit.lakebase);
    });
  },
}).catch(console.error);
