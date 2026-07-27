import { env } from "cloudflare:workers";

const ensureTable = async () => {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    collection_time TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  )`).run();
};

const allowed = (request: Request) => request.headers.get("x-admin-pin") === (env.ADMIN_PIN || "2468");

export async function GET(request: Request) {
  if (!allowed(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTable();
  const result = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  await ensureTable();
  const body = await request.json() as { customer_name?: string; phone?: string; collection_time?: string; notes?: string; items?: unknown[]; total?: number };
  if (!body.customer_name || !body.phone || !body.collection_time || !body.items?.length || !body.total) {
    return Response.json({ error: "Missing order details" }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO orders (id, customer_name, phone, collection_time, notes, items, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)")
    .bind(id, String(body.customer_name).slice(0, 100), String(body.phone).slice(0, 40), String(body.collection_time).slice(0, 40), String(body.notes || "").slice(0, 500), JSON.stringify(body.items), Math.round(Number(body.total)), new Date().toISOString()).run();
  return Response.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!allowed(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTable();
  const body = await request.json() as { id?: string; status?: string };
  if (!body.id || !["new", "preparing", "ready", "collected"].includes(body.status || "")) return Response.json({ error: "Invalid update" }, { status: 400 });
  await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(body.status, body.id).run();
  return Response.json({ ok: true });
}
