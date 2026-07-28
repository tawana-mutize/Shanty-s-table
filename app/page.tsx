"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type MenuItem = { id: string; name: string; description: string; price: number; image: string; badge?: string; kind: "ready" | "build" | "snack"; available?: boolean };
type CartItem = MenuItem & { qty: number; choices?: string[] };
type Order = { id: string; customer_name: string; phone: string; collection_time: string; notes: string; items: string; total: number; status: string; created_at: string };

const defaultMenu: MenuItem[] = [
  { id: "fries-chicken", name: "Fries & Chicken", description: "Sticky grilled chicken, seasoned fries & fresh salads", price: 25, image: "/food/fries-chicken.jpeg", badge: "Popular", kind: "ready" },
  { id: "fries-ribs", name: "Fries & Ribs", description: "Tender glazed ribs with golden seasoned fries", price: 35, image: "/food/fries-chicken.jpeg", kind: "ready" },
  { id: "fish-chips", name: "Fish & Chips", description: "Crispy spiced fish, chips, lemon & sweet chilli", price: 25, image: "/food/fish-chips.jpeg", kind: "ready" },
  { id: "kebab", name: "Kebab Box", description: "A loaded box of kebab, fries, salad & sauce", price: 30, image: "/food/jollof-chicken.jpeg", kind: "ready" },
  { id: "jollof", name: "Jollof, Chicken & Mince", description: "A full plate of jollof rice, savoury mince & baked chicken", price: 30, image: "/food/jollof-chicken.jpeg", badge: "Shanty's pick", kind: "ready" },
  { id: "pasta", name: "Pasta & Savoury Mince", description: "Tagliatelle topped with rich mince, coleslaw & potato salad", price: 30, image: "/food/pasta-mince.jpeg", kind: "ready" },
  { id: "rice", name: "Build your Rice", description: "Choose your stew and add a fresh side", price: 30, image: "/food/rice-stew.jpeg", kind: "build" },
  { id: "sadza", name: "Build your Sadza", description: "Choose your protein and vegetables", price: 30, image: "/food/sadza-beef.jpeg", kind: "build" },
  { id: "pies", name: "Homemade Pies", description: "Flaky, golden and freshly baked", price: 10, image: "/food/pies.jpeg", kind: "snack" },
  { id: "samosas", name: "Samosas", description: "Crispy handmade savoury parcels", price: 10, image: "/food/samosas.jpeg", kind: "snack" },
  { id: "drinks", name: "Soft Drinks", description: "Cold assorted soft drinks", price: 10, image: "/food/fries-chicken.jpeg", kind: "snack" },
];

const choices: Record<string, { proteins: string[]; sides: string[] }> = {
  rice: { proteins: ["Beef stew", "Chicken stew", "Savoury mince"], sides: ["No side", "Coleslaw", "Cabbage"] },
  sadza: { proteins: ["Beef stew", "Chicken stew", "Savoury mince"], sides: ["No side", "Cabbage", "Coleslaw"] },
};

const money = (n: number) => `${n.toFixed(0)} PLN`;

export default function Home() {
  const [tab, setTab] = useState<"menu" | "admin">("menu");
  const [menu, setMenu] = useState<MenuItem[]>(defaultMenu);
  const [filter, setFilter] = useState<"all" | "ready" | "build" | "snack">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [builder, setBuilder] = useState<MenuItem | null>(null);
  const [protein, setProtein] = useState("");
  const [side, setSide] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [success, setSuccess] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminView, setAdminView] = useState<"orders" | "menu">("orders");
  const [editingMeal, setEditingMeal] = useState<MenuItem | null>(null);
  const [savingMeal, setSavingMeal] = useState(false);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  const add = (item: MenuItem, selected: string[] = []) => {
    const key = `${item.id}-${selected.join("-")}`;
    setCart((old) => {
      const found = old.find((x) => `${x.id}-${(x.choices || []).join("-")}` === key);
      return found ? old.map((x) => x === found ? { ...x, qty: x.qty + 1 } : x) : [...old, { ...item, qty: 1, choices: selected }];
    });
    setBuilder(null);
  };

  const openItem = (item: MenuItem) => {
    if (item.kind === "build" && choices[item.id]) {
      setBuilder(item); setProtein(choices[item.id].proteins[0]); setSide(choices[item.id].sides[0]);
    } else add(item);
  };

  const loadOrders = async () => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) return false;
    setOrders((data || []).map((order) => ({ ...order, items: JSON.stringify(order.items) })) as Order[]);
    setAdminUnlocked(true);
    return true;
  };

  const loadMenu = async (includeUnavailable = false) => {
    let query = supabase.from("menu_items").select("*").order("sort_order").order("name");
    const { data } = await query;
    if (data) setMenu(data as MenuItem[]);
  };

  useEffect(() => {
    loadMenu();
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setAdminEmail(data.session.user.email || "");
        await loadOrders();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (adminUnlocked) {
      loadMenu(true);
      const timer = setInterval(loadOrders, 15000);
      return () => clearInterval(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUnlocked]);

  const submitOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      customer_name: form.get("name"), phone: form.get("phone"), collection_time: form.get("time"),
      notes: form.get("notes"), items: cart.map(({ name, qty, choices }) => ({ name, qty, choices })), total,
    };
    const id = crypto.randomUUID();
    const { error } = await supabase.from("orders").insert({ id, ...payload, status: "new" });
    if (!error) {
      setSuccess(id); setCart([]); setCheckout(false); setCartOpen(false);
    } else alert("We couldn't send your order. Please try again.");
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    loadOrders();
  };

  const login = async () => {
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: adminEmail.trim(), password: adminPassword });
    if (error || !(await loadOrders())) {
      await supabase.auth.signOut();
      setLoginError("The email or password is incorrect, or this account is not a Kitchen administrator.");
      return;
    }
    setAdminPassword("");
    await loadMenu(true);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAdminUnlocked(false);
    setOrders([]);
    setAdminPassword("");
    await loadMenu();
  };

  const saveMeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMeal) return;
    setSavingMeal(true);
    const isNew = !editingMeal.id;
    const meal = {
      ...editingMeal,
      id: editingMeal.id || `${editingMeal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 35)}-${crypto.randomUUID().slice(0, 6)}`,
      badge: editingMeal.badge || "",
      available: editingMeal.available !== false,
      sort_order: isNew ? menu.length : undefined,
      updated_at: new Date().toISOString(),
    };
    const { error } = isNew
      ? await supabase.from("menu_items").insert(meal)
      : await supabase.from("menu_items").update(meal).eq("id", meal.id);
    setSavingMeal(false);
    if (!error) { setEditingMeal(null); await loadMenu(true); }
    else alert("The meal could not be saved.");
  };

  const uploadMealImage = async (file?: File) => {
    if (!file || !editingMeal) return;
    if (file.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Upload a JPG, PNG or WebP smaller than 8 MB.");
      return;
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("menu-images").upload(key, file, { contentType: file.type });
    if (!error) {
      const { data } = supabase.storage.from("menu-images").getPublicUrl(key);
      const url = data.publicUrl;
      setEditingMeal({ ...editingMeal, image: url });
    } else alert("The image could not be uploaded.");
  };

  return (
    <main>
      <header>
        <button className="brand" onClick={() => { setTab("menu"); window.scrollTo(0, 0); }}>
          <img src="/logo.jpeg" alt="Shanty's Table" /><span>Shanty&apos;s <em>Table</em></span>
        </button>
        <nav>
          <button className={tab === "menu" ? "active" : ""} onClick={() => setTab("menu")}>Menu</button>
          <span>Shanty&apos;s cooking something special</span>
        </nav>
        <button className="cart-button" onClick={() => setCartOpen(true)}>Bag <b>{count}</b></button>
      </header>

      {tab === "menu" ? <>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Made with love, served with joy</p>
            <h1>Home on<br />a <i>plate.</i></h1>
            <p>Comfort food, cooked from the heart. Pick a favourite or build your perfect plate—ready for collection.</p>
            <button className="primary" onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}>Explore the menu <span>↓</span></button>
            <div className="hero-notes"><span>♡ Freshly made</span><span>◷ Pay on collection</span></div>
          </div>
          <div className="hero-image"><img src="/food/fries-chicken.jpeg" alt="Fries, grilled chicken and salads" /><span className="seal">SHANTY&apos;S<br /><b>TABLE</b></span></div>
        </section>

        <section className="menu-section" id="menu">
          <div className="section-heading"><div><p className="eyebrow">What are you craving?</p><h2>Choose your meal</h2></div><p>Every plate is made fresh. Order ahead and pay when you collect.</p></div>
          <div className="filters">
            {(["all", "ready", "build", "snack"] as const).map((f) => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All dishes" : f === "build" ? "Build a plate" : f === "ready" ? "Ready meals" : "Snacks & drinks"}</button>)}
          </div>
          <div className="grid">
            {menu.filter((m) => filter === "all" || m.kind === filter).map((item) => (
              <article className={`card ${item.available === false ? "sold-out-card" : ""}`} key={item.id}>
                <div className="card-image"><img src={item.image} alt={item.name} />{item.available === false ? <span className="sold-out-badge">Sold out today</span> : item.badge && <span>{item.badge}</span>}</div>
                <div className="card-body"><div><p className="kind">{item.kind === "build" ? "Make it yours" : item.kind === "snack" ? "Something extra" : "Ready to order"}</p><h3>{item.name}</h3><p>{item.description}</p></div>
                  <div className="card-bottom"><strong>{money(item.price)}</strong><button disabled={item.available === false} aria-label={item.available === false ? `${item.name} is sold out` : `Add ${item.name}`} onClick={() => openItem(item)}>{item.available === false ? "Sold out" : item.kind === "build" ? "Choose" : "+"}</button></div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="collection"><div><p className="eyebrow">Simple & easy</p><h2>Order now.<br /><i>Pay when you collect.</i></h2></div><div className="steps"><p><b>01</b><span><strong>Choose your food</strong>Pick a ready meal or build your own plate.</span></p><p><b>02</b><span><strong>Tell us when</strong>Choose a collection time that suits you.</span></p><p><b>03</b><span><strong>Collect & enjoy</strong>Pay in person and take home something delicious.</span></p></div></section>
      </> : <section className="admin">
        <p className="eyebrow">Shanty&apos;s dashboard</p>
        <h1>{adminView === "orders" ? "Today’s orders" : "Manage menu"}</h1>
        {!adminUnlocked ? <div className="pin-box"><h2>Owner access</h2><p>Sign in to manage orders and meals.</p><label>Email address<input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="name@example.com" /></label><label>Password<input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Your Kitchen password" onKeyDown={(e) => e.key === "Enter" && login()} /></label>{loginError && <p className="login-error">{loginError}</p>}<button className="primary" onClick={login}>Open dashboard</button><small>For Shanty&apos;s team only.</small></div>
        : <>
          <div className="dashboard-tabs">
            <button className={adminView === "orders" ? "active" : ""} onClick={() => setAdminView("orders")}>Orders</button>
            <button className={adminView === "menu" ? "active" : ""} onClick={() => setAdminView("menu")}>Menu & availability</button>
            <button onClick={logout}>Sign out</button>
          </div>
          {adminView === "orders" ? <>
            <div className="admin-tools"><span>{orders.length} orders</span><button onClick={loadOrders}>Refresh</button></div>
            <div className="orders">{orders.length === 0 && <div className="empty">No orders yet. They&apos;ll appear here automatically.</div>}{orders.map((o) => <article className="order" key={o.id}><div className="order-top"><strong>#{o.id.slice(-6).toUpperCase()}</strong><span className={`status ${o.status}`}>{o.status}</span></div><h3>{o.customer_name}</h3><p>{o.phone} · Collect: {o.collection_time}</p><ul>{JSON.parse(o.items).map((x: {name: string; qty: number; choices?: string[]}, i: number) => <li key={i}><b>{x.qty}×</b> {x.name} {x.choices?.length ? <small>— {x.choices.join(", ")}</small> : null}</li>)}</ul>{o.notes && <p className="note">“{o.notes}”</p>}<div className="order-total"><strong>{money(o.total)}</strong><select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}><option>new</option><option>preparing</option><option>ready</option><option>collected</option></select></div></article>)}</div>
          </> : <>
            <div className="admin-tools"><span>{menu.filter((m) => m.available !== false).length} meals currently available</span><button className="add-meal-button" onClick={() => setEditingMeal({ id: "", name: "", description: "", price: 0, image: "/food/fries-chicken.jpeg", kind: "ready", available: true })}>+ Add a new meal</button></div>
            <div className="menu-admin">{menu.map((meal) => <article key={meal.id} className={`meal-row ${meal.available === false ? "off" : ""}`}>
              <img src={meal.image} alt="" />
              <div><h3>{meal.name}</h3><p>{meal.description}</p><strong>{money(meal.price)}</strong></div>
              <div className="meal-actions"><span className={meal.available === false ? "soldout" : "available"}>{meal.available === false ? "Sold out" : "Available"}</span><button onClick={() => setEditingMeal(meal)}>Edit</button><button onClick={async () => { await supabase.from("menu_items").update({ available: meal.available === false, updated_at: new Date().toISOString() }).eq("id", meal.id); loadMenu(true); }}>{meal.available === false ? "Make available" : "Mark sold out"}</button></div>
            </article>)}</div>
          </>}
        </>}
      </section>}

      {editingMeal && <div className="overlay" onClick={() => setEditingMeal(null)}><form className="modal meal-form" onSubmit={saveMeal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={() => setEditingMeal(null)}>×</button>
        <p className="eyebrow">{editingMeal.id ? "Edit meal" : "Add a new meal"}</p><h2>{editingMeal.name || "New menu item"}</h2>
        <label>Meal name<input required value={editingMeal.name} onChange={(e) => setEditingMeal({ ...editingMeal, name: e.target.value })} /></label>
        <label>Description<textarea required value={editingMeal.description} onChange={(e) => setEditingMeal({ ...editingMeal, description: e.target.value })} /></label>
        <div className="form-pair"><label>Price (PLN)<input required min="0" type="number" value={editingMeal.price} onChange={(e) => setEditingMeal({ ...editingMeal, price: Number(e.target.value) })} /></label><label>Category<select value={editingMeal.kind} onChange={(e) => setEditingMeal({ ...editingMeal, kind: e.target.value as MenuItem["kind"] })}><option value="ready">Ready meal</option><option value="build">Build a plate</option><option value="snack">Snack or drink</option></select></label></div>
        <label>Badge (optional)<input value={editingMeal.badge || ""} placeholder="Popular, New…" onChange={(e) => setEditingMeal({ ...editingMeal, badge: e.target.value })} /></label>
        <label>Food picture<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadMealImage(e.target.files?.[0])} /></label>
        <div className="image-preview"><img src={editingMeal.image} alt="Meal preview" /></div>
        <label className="check"><input type="checkbox" checked={editingMeal.available !== false} onChange={(e) => setEditingMeal({ ...editingMeal, available: e.target.checked })} /> Available for customers to order</label>
        <button className="primary wide" disabled={savingMeal}>{savingMeal ? "Saving…" : "Save meal"}</button>
      </form></div>}

      {builder && <div className="overlay" onClick={() => setBuilder(null)}><div className="modal builder" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setBuilder(null)}>×</button><img src={builder.image} alt="" /><p className="eyebrow">Build your plate</p><h2>{builder.name}</h2><label>Choose one protein<select value={protein} onChange={(e) => setProtein(e.target.value)}>{choices[builder.id].proteins.map((x) => <option key={x}>{x}</option>)}</select></label><label>Choose a side<select value={side} onChange={(e) => setSide(e.target.value)}>{choices[builder.id].sides.map((x) => <option key={x}>{x}</option>)}</select></label><button className="primary wide" onClick={() => add(builder, [protein, side].filter((x) => x !== "No side"))}>Add to bag · {money(builder.price)}</button></div></div>}

      {cartOpen && <div className="overlay side" onClick={() => setCartOpen(false)}><aside className="cart" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setCartOpen(false)}>×</button><p className="eyebrow">Your order</p><h2>{checkout ? "Collection details" : "Your bag"}</h2>{success ? <div className="success"><span>✓</span><h3>Shanty is making your meal!</h3><p>Your order <b>#{success.slice(-6).toUpperCase()}</b> has reached the kitchen. Pay when you collect.</p><button className="primary" onClick={() => { setSuccess(""); setCartOpen(false); }}>Done</button></div> : checkout ? <form onSubmit={submitOrder}><div className="checkout-steps"><p><b>1</b> Choose your food</p><p><b>2</b> Tell us when</p><p><b>3</b> Collect &amp; enjoy</p></div><label>Your name<input required name="name" /></label><label>Phone number<input required name="phone" type="tel" /></label><label>Pickup time<select required name="time" defaultValue=""><option value="" disabled>Choose a pickup time</option><option value="Afternoon">Afternoon</option><option value="Late evening">Late evening</option></select></label><label>Anything we should know?<textarea name="notes" placeholder="Allergies, special requests…" /></label><div className="pay-note">No online payment. Pay <b>{money(total)}</b> when you collect.</div><button className="primary wide">Place order</button><button type="button" className="back" onClick={() => setCheckout(false)}>← Back to bag</button></form> : <>{cart.length === 0 ? <div className="empty">Your bag is hungry. Add something delicious!</div> : <><div className="cart-items">{cart.map((item, i) => <div className="cart-item" key={`${item.id}-${i}`}><img src={item.image} alt="" /><div><h3>{item.name}</h3><small>{item.choices?.join(" · ")}</small><strong>{money(item.price)}</strong></div><div className="qty"><button onClick={() => setCart((old) => old.map((x, j) => j === i ? {...x, qty: Math.max(0, x.qty - 1)} : x).filter((x) => x.qty > 0))}>−</button><span>{item.qty}</span><button onClick={() => setCart((old) => old.map((x, j) => j === i ? {...x, qty: x.qty + 1} : x))}>+</button></div></div>)}</div><div className="summary"><span>Total</span><strong>{money(total)}</strong></div><p className="payline">Pay when you collect</p><button className="primary wide" onClick={() => setCheckout(true)}>Continue to collection</button></>}</>}</aside></div>}
      <footer><img src="/logo.jpeg" alt="" /><p>Shanty&apos;s Table<br /><span>Made with love, served with joy.</span></p><p>Fresh homemade food<br />Order ahead · Collect · Enjoy<br /><button className="owner-link" onClick={() => { setTab("admin"); window.scrollTo(0, 0); }}>Owner access</button></p></footer>
    </main>
  );
}
