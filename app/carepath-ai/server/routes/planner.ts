// =====================================================================
// Planner Workspace CRUD over Lakebase (Postgres).
// Persists shortlists / notes / rank overrides so a planner's decisions
// survive across sessions — completes workflow step 7 ("Planner Decisions").
//
// Access pattern follows the Lakebase plugin docs: the `appkit.lakebase`
// handle (passed in from server.ts) exposes `.query(text, params)` against the
// service-principal pool. We key rows by the app user's identity header rather
// than using row-level security, to avoid per-user Postgres role setup.
// =====================================================================
import type { Application, Request, Response } from 'express';

// Minimal shape we use from appkit.lakebase (a pg.Pool-like handle).
type Lakebase = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

// Databricks Apps forwards the authenticated user's identity on each request.
function currentUser(req: Request): string {
  const h = req.headers['x-forwarded-email'];
  if (typeof h === 'string' && h.trim() !== '') return h;
  if (Array.isArray(h) && h[0]) return h[0];
  return 'anonymous';
}

// Idempotent schema creation. The service principal owns the schema once the
// app is deployed; locally this is a no-op after the first deploy.
export async function initPlannerSchema(lakebase: Lakebase): Promise<void> {
  await lakebase.query(`CREATE SCHEMA IF NOT EXISTS app`);
  await lakebase.query(`
    CREATE TABLE IF NOT EXISTS app.planner_shortlist (
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_by    TEXT        NOT NULL,
      facility_id   TEXT        NOT NULL,
      specialty     TEXT,
      pincode       INTEGER,
      note          TEXT,
      override_rank INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (created_by, facility_id, specialty)
    )`);
  await lakebase.query(
    `CREATE INDEX IF NOT EXISTS idx_shortlist_user
       ON app.planner_shortlist (created_by, created_at DESC)`,
  );
}

export function registerPlannerRoutes(app: Application, lakebase: Lakebase): void {
  // List the current planner's shortlist (overrides first, then most recent).
  app.get('/api/shortlist', async (req: Request, res: Response) => {
    try {
      const { rows } = await lakebase.query(
        `SELECT id, facility_id, specialty, pincode, note, override_rank, created_at
           FROM app.planner_shortlist
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
      const body = (req.body ?? {}) as {
        facility_id?: string;
        specialty?: string | null;
        pincode?: number | null;
        note?: string | null;
        override_rank?: number | null;
      };
      const { facility_id, specialty, pincode, note, override_rank } = body;
      if (!facility_id) {
        res.status(400).json({ error: 'facility_id is required' });
        return;
      }
      await lakebase.query(
        `INSERT INTO app.planner_shortlist
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
      await lakebase.query('DELETE FROM app.planner_shortlist WHERE id = $1 AND created_by = $2', [
        req.params.id,
        currentUser(req),
      ]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
