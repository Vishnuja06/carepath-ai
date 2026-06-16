// =====================================================================
// Planner Workspace CRUD over Lakebase (Postgres).
// Persists shortlists / notes / rank overrides so a planner's decisions
// survive across sessions — completes workflow step 7 ("Planner Decisions").
//
// ⚠️ Two symbols to confirm against node_modules/@databricks/appkit/CLAUDE.md
//    after `npm install` (node_modules is not vendored):
//      1. The pg accessor exported by the lakebase plugin. We assume
//         `getLakebasePool()` returning a node-postgres-style pool with
//         `.query(text, params)`. If the plugin instead exposes a tagged
//         `sql` helper or a declarative query-file pattern, swap the calls.
//      2. The Express `app` type/shape passed to onServerReady in server.ts.
// Everything else (SQL, identity handling, route shape) is standard.
// =====================================================================
import type { Express, Request, Response } from 'express';
import { getLakebasePool } from '@databricks/appkit'; // ⚠️ confirm accessor name

// Databricks Apps forwards the authenticated user's identity on each request.
// `x-forwarded-email` is the documented header; fall back defensively.
function currentUser(req: Request): string {
  const h = req.headers['x-forwarded-email'];
  if (typeof h === 'string' && h.trim() !== '') return h;
  if (Array.isArray(h) && h[0]) return h[0];
  return 'anonymous';
}

export function registerPlannerRoutes(app: Express): void {
  // List the current planner's shortlist (most recent first).
  app.get('/api/shortlist', async (req: Request, res: Response) => {
    try {
      const pool = await getLakebasePool();
      const { rows } = await pool.query(
        `SELECT id, facility_id, specialty, pincode, note, override_rank, created_at
           FROM planner_shortlist
          WHERE created_by = $1
          ORDER BY COALESCE(override_rank, 2147483647), created_at DESC`,
        [currentUser(req)],
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Add or update a shortlist entry (upsert on planner+facility+specialty).
  app.post('/api/shortlist', async (req: Request, res: Response) => {
    try {
      const { facility_id, specialty, pincode, note, override_rank } = req.body ?? {};
      if (!facility_id) {
        res.status(400).json({ error: 'facility_id is required' });
        return;
      }
      const pool = await getLakebasePool();
      await pool.query(
        `INSERT INTO planner_shortlist
           (created_by, facility_id, specialty, pincode, note, override_rank)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (created_by, facility_id, specialty)
         DO UPDATE SET note = EXCLUDED.note,
                       override_rank = EXCLUDED.override_rank,
                       pincode = EXCLUDED.pincode,
                       updated_at = now()`,
        [
          currentUser(req),
          facility_id,
          specialty ?? null,
          pincode ?? null,
          note ?? null,
          override_rank ?? null,
        ],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Remove a shortlist entry (scoped to the requesting planner).
  app.delete('/api/shortlist/:id', async (req: Request, res: Response) => {
    try {
      const pool = await getLakebasePool();
      await pool.query('DELETE FROM planner_shortlist WHERE id = $1 AND created_by = $2', [
        req.params.id,
        currentUser(req),
      ]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
