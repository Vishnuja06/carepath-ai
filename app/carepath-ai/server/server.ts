import { createApp, analytics, serving, server } from '@databricks/appkit';

createApp({
  plugins: [
    analytics(),
    serving(),
    server(),
  ],
}).catch(console.error);
