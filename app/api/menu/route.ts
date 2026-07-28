import { env } from "cloudflare:workers";

const defaults = [
  ["fries-chicken", "Fries & Chicken", "Sticky grilled chicken, seasoned fries & fresh salads", 25, "/food/fries-chicken.jpeg", "Popular", "ready"],
  ["fries-ribs", "Fries & Ribs", "Tender glazed ribs with golden seasoned fries", 35, "/food/fries-chicken.jpeg", "", "ready"],
  ["fish-chips", "Fish & Chips", "Crispy spiced fish, chips, lemon & sweet chilli", 25, "/food/fish-chips.jpeg", "", "ready"],
  ["kebab", "Kebab Box", "A loaded box of kebab, fries, salad & sauce", 30, "/food/jollof-chicken.jpeg", "", "ready"],
  ["jollof", "Jollof, Chicken & Mince", "A full plate of jollof rice, savoury mince & baked chicken", 30, "/food/jollof-chicken.jpeg", "Shanty's pick", "ready"],
  ["pasta", "Pasta & Savoury Mince", "Tagliatelle topped with rich mince, coleslaw & potato salad", 30, "/food/pasta-mince.jpeg", "", "ready"],
  ["rice", "Build your Rice", "Choose your stew and add a fresh side", 30, "/food/rice-stew.jpeg", "", "build"],
  ["sadza", "Build your Sadza", "Choose your protein and vegetables", 30, "/food/sadza-beef.jpeg", "", "build"],
  ["pies", "Homemade Pies", "Flaky, golden and freshly baked", 10, "/food/pies.jpeg", "", "snack"],
  ["samosas", "Samosas", "Crispy handmade savoury parcels", 10, "/food/samosas.jpeg", "", "snack"],
  ["drinks", "Soft Drinks", "Cold assorted soft drinks", 10, "/food/fries-chicken.jpeg", "", "snack"],
] as const;

const isAdmin = (request: Request) => Boolean(env.ADMIN_PIN) && request.headers.get("x-admin-pin") === env.ADMIN_PIN;

async function ensureMenu() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    image TEXT NOT NULL,
    badge TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL,
    available INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`).run();
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM menu_items").first<{ total: number }>();
  if (!count?.total) {
    const now = new Date().toISOString();
    await env.DB.batch(defaults.map((item, index) =>
      env.DB.prepare("INSERT INTO menu_items (id, name, description, price, image, badge, kind, available, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
        .bind(...item, index, now)
    ));
  }
}

export async function GET(request: Request) {
  await ensureMenu();
  const query = isAdmin(request)
    ? "SELECT * FROM menu_items ORDER BY sort_order, name"
    : "SELECT * FROM menu_items WHERE available = 1 ORDER BY sort_order, name";
  const result = await env.DB.prepare(query).all();
  return Response.json(result.results.map((item) => ({ ...item, available: Boolean(item.available) })));
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureMenu();
  const body = await request.json() as Record<string, unknown>;
  if (!body.name || !body.description || !body.image || !["ready", "build", "snack"].includes(String(body.kind))) {
    return Response.json({ error: "Missing meal details" }, { status: 400 });
  }
  const id = `${String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 35)}-${crypto.randomUUID().slice(0, 6)}`;
  const order = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM menu_items").first<{ next_order: number }>();
  await env.DB.prepare("INSERT INTO menu_items (id, name, description, price, image, badge, kind, available, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, String(body.name).slice(0, 100), String(body.description).slice(0, 500), Math.max(0, Math.round(Number(body.price))), String(body.image), String(body.badge || "").slice(0, 40), body.kind, body.available === false ? 0 : 1, order?.next_order || 0, new Date().toISOString()).run();
  return Response.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureMenu();
  const body = await request.json() as Record<string, unknown>;
  if (!body.id || !body.name || !body.description || !body.image || !["ready", "build", "snack"].includes(String(body.kind))) {
    return Response.json({ error: "Invalid meal details" }, { status: 400 });
  }
  await env.DB.prepare("UPDATE menu_items SET name = ?, description = ?, price = ?, image = ?, badge = ?, kind = ?, available = ?, updated_at = ? WHERE id = ?")
    .bind(String(body.name).slice(0, 100), String(body.description).slice(0, 500), Math.max(0, Math.round(Number(body.price))), String(body.image), String(body.badge || "").slice(0, 40), body.kind, body.available === false ? 0 : 1, new Date().toISOString(), body.id).run();
  return Response.json({ ok: true });
}
