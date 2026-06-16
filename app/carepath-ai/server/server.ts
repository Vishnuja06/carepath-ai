import { createApp, analytics, serving, server, genie } from '@databricks/appkit';

// AI/BI Genie is optional and env-gated so the app boots cleanly even when no
// Genie space is wired yet. Set DATABRICKS_GENIE_SPACE_ID (and, on the client,
// VITE_GENIE_ENABLED=true) to light up the "Live Genie" tab in Insights.
createApp({
  plugins: [
    analytics(),
    serving(),
    server(),
    ...(process.env.DATABRICKS_GENIE_SPACE_ID
      ? [genie({ spaces: { insights: process.env.DATABRICKS_GENIE_SPACE_ID } })]
      : []),
  ],
}).catch(console.error);
