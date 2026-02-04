require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

/* =========================
   ENV
========================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

/* =========================
   BOT INIT
========================= */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ Bot lancé");

/* =========================
   PATHS / DATA
========================= */
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const ASSETS_DIR = path.join(ROOT, "assets");

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  orders: path.join(DATA_DIR, "orders.json"),
  discounts: path.join(DATA_DIR, "discounts.json"),
  tickets: path.join(DATA_DIR, "tickets.json"),
  audit: path.join(DATA_DIR, "audit.json"),
  blocks: path.join(DATA_DIR, "blocks.json")
};

const IMAGE_PATH = path.join(ASSETS_DIR, "welcome.jpg");

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const defaults = {
    users: {},
    orders: [],
    discounts: [],
    tickets: {},
    audit: [],
    blocks: {}
  };

  for (const [k, f] of Object.entries(FILES)) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(defaults[k], null, 2));
  }
}
ensureFiles();

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* =========================
   LINKS (fourni par toi)
========================= */
const LINKS = {
  telegram: "https://t.me/+GHwxWTV0RoRiZjA0",
  luffa: "https://callup.luffa.im/c/8PiYHFBvV1z",
  snapchat: "https://snapchat.com/t/mf5ujrdV",
  miniapp: "https://duruozan68-jpg.github.io/calidad56-miniapp/",
  secretary: "https://t.me/Calidad_Secretaire"
};

const SHARE_URL =
  "https://t.me/share/url?" +
  "url=" + encodeURIComponent(LINKS.telegram) +
  "&text=" + encodeURIComponent(
    "💚 Rejoins les canaux officiels Calidad 🚜\n\n" +
    "Telegram : " + LINKS.telegram + "\n" +
    "Luffa : " + LINKS.luffa
  );

/* =========================
   SECURITY / RATE LIMIT
========================= */
const clickWindowMs = 2500;
const maxClicksPerWindow = 8;
const clicks = new Map(); // userId -> {ts, count}

function isBlocked(userId) {
  const blocks = readJSON(FILES.blocks, {});
  return Boolean(blocks[String(userId)]?.blocked);
}

function setBlocked(userId, blocked, reason = "") {
  const blocks = readJSON(FILES.blocks, {});
  blocks[String(userId)] = {
    blocked,
    reason,
    at: new Date().toISOString()
  };
  writeJSON(FILES.blocks, blocks);
}

function rateLimitOrThrow(userId) {
  const now = Date.now();
  const key = String(userId);
  const cur = clicks.get(key) || { ts: now, count: 0 };

  if (now - cur.ts > clickWindowMs) {
    cur.ts = now;
    cur.count = 0;
  }
  cur.count++;
  clicks.set(key, cur);

  if (cur.count > maxClicksPerWindow) {
    throw new Error("RATE_LIMIT");
  }
}

/* =========================
   AUDIT (admin actions)
========================= */
function audit(action, byUserId, meta = {}) {
  const arr = readJSON(FILES.audit, []);
  arr.push({
    at: new Date().toISOString(),
    action,
    by: String(byUserId),
    meta
  });
  // keep last 2000 logs
  if (arr.length > 2000) arr.splice(0, arr.length - 2000);
  writeJSON(FILES.audit, arr);
}

/* =========================
   USERS / VIP / POINTS
========================= */
function isAdmin(from) {
  return ADMIN_ID && String(from.id) === String(ADMIN_ID);
}

function loadUsers() {
  return readJSON(FILES.users, {});
}
function saveUsers(users) {
  writeJSON(FILES.users, users);
}

function upsertUser(from) {
  const users = loadUsers();
  const id = String(from.id);
  const now = new Date().toISOString();

  if (!users[id]) {
    users[id] = {
      id,
      first_name: from.first_name || "",
      last_name: from.last_name || "",
      username: from.username || null,
      joined_at: now,
      last_seen_at: now,

      // business fields
      vip_tier: "NONE",      // NONE / BRONZE / SILVER / GOLD
      vip_until: null,       // ISO date
      points: 0,

      discounts_active: [],  // [{code,type,value,expires_at,created_at,source}]
      discounts_used: [],    // [{code,used_at,orderId?}]

      orders: [],            // list of orderIds
      ticket_history: [],    // [{at,reward,label}]
      last_ticket_at: null,  // ISO
      clicks: 0
    };
  } else {
    users[id].first_name = from.first_name || users[id].first_name;
    users[id].last_name = from.last_name || users[id].last_name;
    users[id].username = from.username || users[id].username;
    users[id].last_seen_at = now;
  }

  saveUsers(users);
  return users[id];
}

function getUser(userId) {
  const users = loadUsers();
  return users[String(userId)] || null;
}

function saveUser(u) {
  const users = loadUsers();
  users[String(u.id)] = u;
  saveUsers(users);
}

function vipActive(u) {
  if (!u.vip_until) return false;
  return Date.now() < new Date(u.vip_until).getTime();
}

function normalizeVip(u) {
  // expire VIP automatically
  if (u.vip_tier !== "NONE" && u.vip_until && !vipActive(u)) {
    u.vip_tier = "NONE";
    u.vip_until = null;
  }
  return u;
}

function vipBenefits(tier) {
  // tune as you like
  if (tier === "BRONZE") return { permanentDiscountPct: 5, pointsBonusPct: 2 };
  if (tier === "SILVER") return { permanentDiscountPct: 10, pointsBonusPct: 5 };
  if (tier === "GOLD") return { permanentDiscountPct: 15, pointsBonusPct: 8 };
  return { permanentDiscountPct: 0, pointsBonusPct: 0 };
}

/* =========================
   DISCOUNTS
========================= */
function nowIso() { return new Date().toISOString(); }

function addDiscountToUser(u, discount) {
  // discount: {code,type,value,expires_at,created_at,source}
  u.discounts_active.push(discount);
  saveUser(u);
}

function expireDiscounts(u) {
  const now = Date.now();
  u.discounts_active = (u.discounts_active || []).filter(d => {
    if (!d.expires_at) return true;
    return now < new Date(d.expires_at).getTime();
  });
  saveUser(u);
}

function redeemPointsToDiscount(u, pointsCost) {
  if (u.points < pointsCost) return null;

  // example: 200 points -> 10% 7 days
  const code = `PTS-${String(u.id).slice(-4)}-${Date.now().toString().slice(-5)}`;
  const percent = pointsCost >= 500 ? 20 : 10;
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  u.points -= pointsCost;
  addDiscountToUser(u, {
    code,
    type: "PERCENT",
    value: percent,
    expires_at: expires,
    created_at: nowIso(),
    source: "POINTS"
  });
  saveUser(u);
  return { code, percent, expires };
}

/* =========================
   ORDERS
========================= */
const ORDER_STATUS = ["en_attente", "validee", "preparation", "en_livraison", "livree", "annulee"];

function loadOrders() { return readJSON(FILES.orders, []); }
function saveOrders(orders) { writeJSON(FILES.orders, orders); }

function createOrder(userId, amountEUR, note = "") {
  const orders = loadOrders();
  const id = "CMD-" + Date.now();
  const order = {
    id,
    userId: String(userId),
    amount: Number(amountEUR),
    status: "en_attente",
    note,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  orders.push(order);
  saveOrders(orders);
  return order;
}

function getOrder(orderId) {
  const orders = loadOrders();
  return orders.find(o => o.id === orderId) || null;
}

function setOrderStatus(orderId, status) {
  const orders = loadOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return null;
  o.status = status;
  o.updated_at = nowIso();
  saveOrders(orders);
  return o;
}

async function notifyOrderStatus(o) {
  const statusLabel = {
    en_attente: "🕒 En attente",
    validee: "✅ Validée",
    preparation: "👨‍🍳 En préparation",
    en_livraison: "🚚 En livraison",
    livree: "🎉 Livrée",
    annulee: "❌ Annulée"
  }[o.status] || o.status;

  const txt =
    `🧾 <b>Mise à jour commande</b>\n\n` +
    `ID : <code>${o.id}</code>\n` +
    `Montant : <b>${o.amount.toFixed(2)}€</b>\n` +
    `Statut : <b>${statusLabel}</b>\n` +
    `🕒 ${new Date(o.updated_at).toLocaleString()}`;

  await bot.sendMessage(Number(o.userId), txt, { parse_mode: "HTML" }).catch(() => {});
}

/* =========================
   TICKETS (scratch) evolved
========================= */
const TWO_WEEKS_MS = 14 * 24 * 3600 * 1000;

function loadTickets() { return readJSON(FILES.tickets, {}); }
function saveTickets(t) { writeJSON(FILES.tickets, t); }

function nextTicketInMs(u) {
  if (!u.last_ticket_at) return 0;
  const last = new Date(u.last_ticket_at).getTime();
  const left = TWO_WEEKS_MS - (Date.now() - last);
  return Math.max(0, left);
}

function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${d}j ${h}h ${m}m`;
}

function weightedReward(u) {
  // Rewards:
  // - 10% (45)
  // - 20% (25)
  // - livraison gratuite (15)
  // - bonus points (13)
  // - upgrade VIP (2) (rare)
  // VIP users get slightly better odds for points
  const tier = normalizeVip(u).vip_tier;
  const vipBoost = tier !== "NONE";

  const pool = [
    { key: "DISC10", w: 45, label: "🎟 10% de réduction", apply: () => ({ type:"PERCENT", value:10, days:7 }) },
    { key: "DISC20", w: 25, label: "🎟 20% de réduction", apply: () => ({ type:"PERCENT", value:20, days:5 }) },
    { key: "SHIPFREE", w: 15, label: "🚚 Livraison gratuite", apply: () => ({ type:"SHIPFREE", value:1, days:7 }) },
    { key: "POINTS", w: vipBoost ? 18 : 13, label: "🪙 Bonus points", apply: () => ({ type:"POINTS", value: vipBoost ? 120 : 80 }) },
    { key: "VIPUP", w: 2, label: "⭐ Upgrade VIP (rare)", apply: () => ({ type:"VIPUP", value:1 }) }
  ];

  const total = pool.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.w;
    if (r <= 0) return item;
  }
  return pool[0];
}

function applyTicketReward(u, rewardItem) {
  const out = rewardItem.apply();

  if (out.type === "PERCENT") {
    const code = `SCR-${String(u.id).slice(-4)}-${Date.now().toString().slice(-5)}`;
    const expires_at = new Date(Date.now() + out.days * 24 * 3600 * 1000).toISOString();
    addDiscountToUser(u, {
      code,
      type: "PERCENT",
      value: out.value,
      expires_at,
      created_at: nowIso(),
      source: "SCRATCH"
    });
    return { label: rewardItem.label, details: `Code: ${code} (expire: ${new Date(expires_at).toLocaleDateString()})` };
  }

  if (out.type === "SHIPFREE") {
    const code = `SHIP-${String(u.id).slice(-4)}-${Date.now().toString().slice(-5)}`;
    const expires_at = new Date(Date.now() + out.days * 24 * 3600 * 1000).toISOString();
    addDiscountToUser(u, {
      code,
      type: "SHIPFREE",
      value: 1,
      expires_at,
      created_at: nowIso(),
      source: "SCRATCH"
    });
    return { label: rewardItem.label, details: `Code: ${code} (expire: ${new Date(expires_at).toLocaleDateString()})` };
  }

  if (out.type === "POINTS") {
    u.points = (u.points || 0) + out.value;
    saveUser(u);
    return { label: rewardItem.label, details: `+${out.value} points` };
  }

  if (out.type === "VIPUP") {
    // Upgrade at least BRONZE for 14 days (or extend)
    const baseDays = 14;
    const currentTier = normalizeVip(u).vip_tier;
    const newTier = currentTier === "NONE" ? "BRONZE" : currentTier; // keep tier, extend duration
    const untilBase = vipActive(u) ? new Date(u.vip_until).getTime() : Date.now();
    u.vip_tier = newTier;
    u.vip_until = new Date(untilBase + baseDays * 24 * 3600 * 1000).toISOString();
    saveUser(u);
    return { label: rewardItem.label, details: `VIP ${newTier} jusqu’au ${new Date(u.vip_until).toLocaleDateString()}` };
  }

  return { label: rewardItem.label, details: "" };
}

/* =========================
   UI TEXTS
========================= */
const WELCOME_TEXT = `
💚 <b>BIENVENUE SUR Calidad 🚜</b>

⚠️ Attention : Nos bots et canaux Telegram peuvent être désactivés à tout moment. 🚫⏳

👉🚨 Rejoignez notre canal sur Luffa pour rester connectés en cas de bannissement.
Un nouveau lien officiel y sera toujours publié en priorité. 🚨

🔗 Retrouvez tous nos canaux officiels et services ci‑dessous.
`.trim();

const INFO_MENU_TEXT = `ℹ️ <b>Informations</b>\n\nChoisis une option 👇`;

const LIVRAISON_TEXT = `
🚚 <b>Livraison - Morbihan</b>

Notre service de livraison couvre <b>tout le Morbihan</b>.

⚠️ <b>Un minimum de commande est requis</b> pour valider la livraison.
Contactez-nous pour connaître les conditions et les détails de votre zone.
`.trim();

const MEETUP_TEXT = `
🏠 <b>Meetup - Département 56</b>

Le service de Meetup est disponible uniquement dans le <b>département 56 (Morbihan)</b>.
`.trim();

/* =========================
   KEYBOARDS (order demanded)
========================= */
const MAIN_KEYBOARD = {
  inline_keyboard: [
    // 1) infos top-left / contact top-right
    [
      { text: "ℹ️ Informations", callback_data: "info" },
      { text: "📞 Contact", url: LINKS.secretary }
    ],
    // 2) calidad shop miniapp
    [{ text: "🛒 Calidad Shop", web_app: { url: LINKS.miniapp } }],
    // 3) telegram channel
    [{ text: "📢 Canal Telegram", url: LINKS.telegram }],
    // 4) luffa left + snapchat right
    [
      { text: "🌐 Canal Luffa", url: LINKS.luffa },
      { text: "👻 Snapchat", url: LINKS.snapchat }
    ],
    // 5) mon compte left + partager right
    [
      { text: "👤 Mon Compte", callback_data: "account" },
      { text: "🔗 Partager", url: SHARE_URL }
    ]
  ]
};

const INFO_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "🚚 Livraison", callback_data: "livraison" },
      { text: "🏠 Meetup", callback_data: "meetup" }
    ],
    [{ text: "📞 Secrétaire", url: LINKS.secretary }],
    [{ text: "⬅️ Retour", callback_data: "back_home" }]
  ]
};

function accountKeyboard(from) {
  const admin = isAdmin(from);
  const rows = [
    [{ text: "🎟 Ticket à gratter", callback_data: "scratch" }],
    [{ text: "🧾 Mes commandes", callback_data: "my_orders" }],
    [{ text: "💸 Mes réductions", callback_data: "my_discounts" }],
    [{ text: "⭐ VIP", callback_data: "vip_menu" }],
    [{ text: "🪙 Points fidélité", callback_data: "points_menu" }]
  ];
  if (admin) rows.push([{ text: "🛠 Admin Panel", callback_data: "admin_panel" }]);
  rows.push([{ text: "⬅️ Retour", callback_data: "back_home" }]);
  return { inline_keyboard: rows };
}

/* =========================
   ADMIN PANEL
========================= */
const adminSession = new Map(); // adminId -> {mode, ...}

function adminKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📊 Stats", callback_data: "admin_stats" }],
      [{ text: "📦 Commandes (liste)", callback_data: "admin_orders" }],
      [{ text: "👤 Utilisateur (chercher)", callback_data: "admin_user_lookup" }],
      [{ text: "🎟 Tickets (donner)", callback_data: "admin_ticket_give" }],
      [{ text: "💸 Réduction (créer)", callback_data: "admin_discount_create" }],
      [{ text: "⭐ VIP (gérer)", callback_data: "admin_vip_manage" }],
      [{ text: "📣 Broadcast", callback_data: "admin_broadcast" }],
      [{ text: "🧹 Nettoyage inactifs", callback_data: "admin_cleanup" }],
      [{ text: "📤 Export (JSON/CSV)", callback_data: "admin_export" }],
      [{ text: "⬅️ Retour", callback_data: "account" }]
    ]
  };
}

function adminStats() {
  const users = loadUsers();
  const orders = loadOrders();
  const ids = Object.keys(users);
  const now = Date.now();

  const active7d = ids.filter(id => now - new Date(users[id].last_seen_at || 0).getTime() <= 7 * 86400 * 1000).length;

  // orders per day (last 7)
  const perDay = {};
  for (const o of orders) {
    const d = new Date(o.created_at).toISOString().slice(0, 10);
    perDay[d] = (perDay[d] || 0) + 1;
  }
  const lastDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000).toISOString().slice(0, 10);
    lastDays.push(`${d}: ${perDay[d] || 0}`);
  }

  return (
    `📊 <b>Stats</b>\n\n` +
    `👥 Utilisateurs: <b>${ids.length}</b>\n` +
    `🟢 Actifs (7j): <b>${active7d}</b>\n` +
    `📦 Commandes total: <b>${orders.length}</b>\n\n` +
    `<b>Commandes (7 derniers jours)</b>\n` +
    lastDays.map(x => `• ${x}`).join("\n")
  );
}

/* =========================
   ACCOUNT VIEWS
========================= */
function accountText(u, from) {
  u = normalizeVip(u);
  expireDiscounts(u);

  const nextMs = nextTicketInMs(u);
  const nextTxt = nextMs === 0 ? "✅ Disponible" : `⏳ Dans ${formatMs(nextMs)}`;

  const benefits = vipBenefits(u.vip_tier);
  const vipLabel =
    u.vip_tier === "NONE"
      ? "❌ Aucun"
      : `⭐ ${u.vip_tier} (jusqu’au ${new Date(u.vip_until).toLocaleDateString()})`;

  return (
    `👤 <b>Mon Compte</b>\n\n` +
    `• Prénom : <b>${u.first_name || "—"}</b>\n` +
    `• Username : <b>${u.username ? "@" + u.username : "Non défini"}</b>\n` +
    `• ID : <code>${u.id}</code>\n\n` +
    `⭐ VIP : <b>${vipLabel}</b>\n` +
    `💎 Avantages VIP : <b>${benefits.permanentDiscountPct}%</b> permanent, +<b>${benefits.pointsBonusPct}%</b> points\n\n` +
    `🧾 Commandes : <b>${(u.orders || []).length}</b>\n` +
    `💸 Réductions actives : <b>${(u.discounts_active || []).length}</b>\n` +
    `🪙 Points : <b>${u.points || 0}</b>\n` +
    `🎟 Ticket à gratter : <b>${nextTxt}</b>\n\n` +
    (isAdmin(from) ? `🛠 Admin : <b>Oui</b>\n` : ``)
  );
}

function listOrdersText(u) {
  const orders = loadOrders().filter(o => o.userId === String(u.id));
  if (!orders.length) return "🧾 <b>Mes commandes</b>\n\nAucune commande pour le moment.";

  const statusLabel = (s) => ({
    en_attente: "🕒 en attente",
    validee: "✅ validée",
    preparation: "👨‍🍳 préparation",
    en_livraison: "🚚 livraison",
    livree: "🎉 livrée",
    annulee: "❌ annulée"
  }[s] || s);

  const lines = orders
    .slice(-10)
    .reverse()
    .map(o =>
      `• <code>${o.id}</code> — <b>${o.amount.toFixed(2)}€</b> — <b>${statusLabel(o.status)}</b>\n  ${new Date(o.created_at).toLocaleString()}`
    );

  return `🧾 <b>Mes commandes</b>\n\n` + lines.join("\n\n");
}

function listDiscountsText(u) {
  expireDiscounts(u);
  const act = (u.discounts_active || []);
  const used = (u.discounts_used || []).slice(-8).reverse();

  const fmt = (d) => {
    const exp = d.expires_at ? new Date(d.expires_at).toLocaleDateString() : "—";
    const val = d.type === "PERCENT" ? `${d.value}%` : (d.type === "SHIPFREE" ? "Livraison gratuite" : String(d.value));
    return `• <code>${d.code}</code> — <b>${val}</b> — exp: <b>${exp}</b> — source: <b>${d.source}</b>`;
  };

  const a = act.length ? act.map(fmt).join("\n") : "Aucune réduction active.";
  const u2 = used.length
    ? used.map(x => `• <code>${x.code}</code> — utilisée le ${new Date(x.used_at).toLocaleDateString()}`).join("\n")
    : "Aucune réduction utilisée.";

  return `💸 <b>Mes réductions</b>\n\n<b>Actives</b>\n${a}\n\n<b>Historique</b>\n${u2}`;
}

function vipMenuText(u) {
  u = normalizeVip(u);
  if (u.vip_tier === "NONE") {
    return (
      `⭐ <b>VIP</b>\n\n` +
      `Tu n’es pas VIP.\n\n` +
      `• BRONZE: -5% permanent, +2% points\n` +
      `• SILVER: -10% permanent, +5% points\n` +
      `• GOLD: -15% permanent, +8% points\n\n` +
      `👉 Le VIP est géré par l’admin (abonnement).`
    );
  }
  const b = vipBenefits(u.vip_tier);
  return (
    `⭐ <b>VIP</b>\n\n` +
    `Statut: <b>${u.vip_tier}</b>\n` +
    `Jusqu’au: <b>${new Date(u.vip_until).toLocaleDateString()}</b>\n\n` +
    `Avantages: <b>${b.permanentDiscountPct}%</b> permanent, +<b>${b.pointsBonusPct}%</b> points`
  );
}

function pointsMenuText(u) {
  return (
    `🪙 <b>Points fidélité</b>\n\n` +
    `Ton solde: <b>${u.points || 0}</b> points\n\n` +
    `Échanges:\n` +
    `• 200 points → <b>10%</b> (7 jours)\n` +
    `• 500 points → <b>20%</b> (7 jours)\n\n` +
    `Clique un bouton pour échanger 👇`
  );
}

/* =========================
   COMMANDS
========================= */
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  if (isBlocked(userId)) return;

  const u = upsertUser(msg.from);
  u.clicks = (u.clicks || 0) + 1;
  saveUser(u);

  try {
    await bot.sendPhoto(msg.chat.id, IMAGE_PATH, {
      caption: WELCOME_TEXT,
      parse_mode: "HTML",
      reply_markup: MAIN_KEYBOARD
    });
  } catch (err) {
    await bot.sendMessage(msg.chat.id, WELCOME_TEXT, {
      parse_mode: "HTML",
      reply_markup: MAIN_KEYBOARD
    });
  }
});

/* =========================
   ADMIN INPUT HANDLER
========================= */
bot.on("message", async (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith("/")) return;

  if (!isAdmin(msg.from)) return;

  const sid = String(msg.from.id);
  const s = adminSession.get(sid);
  if (!s) return;

  // mode handlers
  if (s.mode === "BROADCAST") {
    adminSession.delete(sid);
    const target = s.target || "ALL";

    const users = loadUsers();
    const ids = Object.keys(users);

    const now = Date.now();
    const targets = ids.filter(id => {
      const u = normalizeVip(users[id]);
      if (target === "ALL") return true;
      if (target === "VIP") return u.vip_tier !== "NONE" && vipActive(u);
      if (target === "INACTIVE") {
        const last = new Date(u.last_seen_at || 0).getTime();
        return now - last > 14 * 86400 * 1000;
      }
      return true;
    });

    let ok = 0, fail = 0;
    for (const id of targets) {
      try {
        await bot.sendMessage(Number(id), msg.text, { parse_mode: "HTML" }).catch(() =>
          bot.sendMessage(Number(id), msg.text)
        );
        ok++;
      } catch {
        fail++;
      }
    }

    audit("broadcast", msg.from.id, { target, ok, fail });

    await bot.sendMessage(msg.chat.id,
      `✅ <b>Broadcast terminé</b>\n\nCible: <b>${target}</b>\nEnvoyé: <b>${ok}</b>\nÉchecs: <b>${fail}</b>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (s.mode === "USER_LOOKUP") {
    adminSession.delete(sid);
    const query = msg.text.trim();
    const users = loadUsers();
    const found = Object.values(users).find(u =>
      String(u.id) === query ||
      (u.username && ("@" + u.username).toLowerCase() === query.toLowerCase()) ||
      (u.username && u.username.toLowerCase() === query.toLowerCase())
    );

    if (!found) {
      return bot.sendMessage(msg.chat.id, "❌ Utilisateur introuvable. (ID ou @username)", { parse_mode: "HTML" });
    }

    const u = normalizeVip(found);
    const txt =
      `👤 <b>User</b>\n\n` +
      `ID: <code>${u.id}</code>\n` +
      `Name: <b>${u.first_name || "—"}</b>\n` +
      `Username: <b>${u.username ? "@" + u.username : "—"}</b>\n` +
      `VIP: <b>${u.vip_tier}</b>\n` +
      `Points: <b>${u.points || 0}</b>\n` +
      `Orders: <b>${(u.orders || []).length}</b>\n` +
      `Blocked: <b>${isBlocked(u.id) ? "Oui" : "Non"}</b>`;

    return bot.sendMessage(msg.chat.id, txt, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🚫 Bloquer", callback_data: `admin_block:${u.id}` },
            { text: "✅ Débloquer", callback_data: `admin_unblock:${u.id}` }
          ],
          [
            { text: "⭐ VIP 30j", callback_data: `admin_vip30:${u.id}` },
            { text: "⭐ VIP 90j", callback_data: `admin_vip90:${u.id}` }
          ],
          [{ text: "⬅️ Admin Panel", callback_data: "admin_panel" }]
        ]
      }
    });
  }

  if (s.mode === "TICKET_GIVE") {
    adminSession.delete(sid);
    const userId = msg.text.trim();
    const u = getUser(userId);
    if (!u) return bot.sendMessage(msg.chat.id, "❌ User introuvable (ID).", { parse_mode: "HTML" });

    // reset cooldown => allow scratch
    u.last_ticket_at = null;
    saveUser(u);
    audit("ticket_give", msg.from.id, { userId: String(userId) });

    await bot.sendMessage(msg.chat.id, `✅ Ticket donné à <code>${userId}</code> (cooldown reset).`, { parse_mode: "HTML" });
    return;
  }

  if (s.mode === "DISCOUNT_CREATE") {
    adminSession.delete(sid);
    // format: CODE PERCENT DAYS  (ex: CALIDAD20 20 14)
    const parts = msg.text.trim().split(/\s+/);
    if (parts.length < 3) {
      return bot.sendMessage(msg.chat.id, "❌ Format: CODE PERCENT JOURS (ex: CALIDAD20 20 14)", { parse_mode: "HTML" });
    }
    const [code, pctS, daysS] = parts;
    const pct = Number(pctS);
    const days = Number(daysS);
    if (!pct || pct < 1 || pct > 90 || !days || days < 1 || days > 365) {
      return bot.sendMessage(msg.chat.id, "❌ Valeurs invalides (pct 1-90, jours 1-365).", { parse_mode: "HTML" });
    }

    const discounts = readJSON(FILES.discounts, []);
    discounts.push({ code, type: "PERCENT", value: pct, days, created_at: nowIso(), active: true });
    writeJSON(FILES.discounts, discounts);

    audit("discount_create", msg.from.id, { code, pct, days });
    return bot.sendMessage(msg.chat.id, `✅ Réduction créée: <code>${code}</code> = <b>${pct}%</b> (${days}j)`, { parse_mode: "HTML" });
  }

  if (s.mode === "VIP_MANAGE") {
    adminSession.delete(sid);
    // format: USERID TIER DAYS
    const parts = msg.text.trim().split(/\s+/);
    if (parts.length < 3) {
      return bot.sendMessage(msg.chat.id, "❌ Format: USERID TIER DAYS (ex: 123 BRONZE 30)", { parse_mode: "HTML" });
    }
    const [userId, tierRaw, daysS] = parts;
    const tier = tierRaw.toUpperCase();
    const days = Number(daysS);

    if (!["BRONZE", "SILVER", "GOLD", "NONE"].includes(tier) || !days || days < 1 || days > 365) {
      return bot.sendMessage(msg.chat.id, "❌ Tier: BRONZE/SILVER/GOLD/NONE, Days: 1-365", { parse_mode: "HTML" });
    }

    const u = getUser(userId);
    if (!u) return bot.sendMessage(msg.chat.id, "❌ User introuvable (ID).", { parse_mode: "HTML" });

    if (tier === "NONE") {
      u.vip_tier = "NONE";
      u.vip_until = null;
    } else {
      u.vip_tier = tier;
      u.vip_until = new Date(Date.now() + days * 86400 * 1000).toISOString();
    }
    saveUser(u);
    audit("vip_manage", msg.from.id, { userId, tier, days });

    await bot.sendMessage(msg.chat.id, `✅ VIP mis à jour pour <code>${userId}</code> → <b>${tier}</b> (${days}j)`, { parse_mode: "HTML" });
    return;
  }
});

/* =========================
   CALLBACKS
========================= */
bot.on("callback_query", async (q) => {
  // ALWAYS answer quickly
  bot.answerCallbackQuery(q.id).catch(() => {});

  const from = q.from;
  const chatId = q.message.chat.id;
  const messageId = q.message.message_id;
  const userId = from.id;

  if (isBlocked(userId)) return;

  try {
    rateLimitOrThrow(userId);
  } catch (e) {
    if (e.message === "RATE_LIMIT") {
      return bot.sendMessage(chatId, "⏳ Trop rapide. Réessaie dans 2 secondes.");
    }
  }

  const u0 = upsertUser(from);
  u0.clicks = (u0.clicks || 0) + 1;
  saveUser(u0);

  // helper: edit caption safely
  async function editCaptionSafe(text, keyboard) {
    return bot.editMessageCaption(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      reply_markup: keyboard
    });
  }

  // ===== MAIN NAV =====
  if (q.data === "back_home") {
    return editCaptionSafe(WELCOME_TEXT, MAIN_KEYBOARD);
  }

  if (q.data === "info") {
    return editCaptionSafe(INFO_MENU_TEXT, INFO_KEYBOARD);
  }

  if (q.data === "livraison") {
    return editCaptionSafe(LIVRAISON_TEXT, INFO_KEYBOARD);
  }

  if (q.data === "meetup") {
    return editCaptionSafe(MEETUP_TEXT, INFO_KEYBOARD);
  }

  if (q.data === "account") {
    const u = normalizeVip(getUser(userId) || upsertUser(from));
    return editCaptionSafe(accountText(u, from), accountKeyboard(from));
  }

  // ===== ACCOUNT: Orders/Discounts/VIP/Points/Tickets =====
  if (q.data === "my_orders") {
    const u = normalizeVip(getUser(userId) || upsertUser(from));
    return bot.sendMessage(chatId, listOrdersText(u), { parse_mode: "HTML" });
  }

  if (q.data === "my_discounts") {
    const u = normalizeVip(getUser(userId) || upsertUser(from));
    return bot.sendMessage(chatId, listDiscountsText(u), { parse_mode: "HTML" });
  }

  if (q.data === "vip_menu") {
    const u = normalizeVip(getUser(userId) || upsertUser(from));
    return bot.sendMessage(chatId, vipMenuText(u), { parse_mode: "HTML" });
  }

  if (q.data === "points_menu") {
    const u = normalizeVip(getUser(userId) || upsertUser(from));
    return bot.sendMessage(chatId, pointsMenuText(u), {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🪙 Échanger 200 → 10%", callback_data: "redeem_200" },
            { text: "🪙 Échanger 500 → 20%", callback_data: "redeem_500" }
          ]
        ]
      }
    });
  }

  if (q.data === "redeem_200" || q.data === "redeem_500") {
    const u = normalizeVip(getUser(userId) || upsertUser(from));
    const cost = q.data === "redeem_500" ? 500 : 200;
    const r = redeemPointsToDiscount(u, cost);
    if (!r) return bot.sendMessage(chatId, "❌ Pas assez de points.");
    return bot.sendMessage(
      chatId,
      `✅ Réduction créée via points.\n\nCode: <code>${r.code}</code>\nValeur: <b>${r.percent}%</b>\nExpire: <b>${new Date(r.expires).toLocaleDateString()}</b>`,
      { parse_mode: "HTML" }
    );
  }

  // ===== SCRATCH TICKET =====
  if (q.data === "scratch") {
    const u = normalizeVip(getUser(userId) || upsertUser(from));

    const left = nextTicketInMs(u);
    if (left > 0) {
      return bot.sendMessage(chatId, `⏳ Ticket indisponible.\nProchain ticket dans: <b>${formatMs(left)}</b>`, { parse_mode: "HTML" });
    }

    // small animation
    const m1 = await bot.sendMessage(chatId, "🎟 Grattage… ⬜⬜⬜", { parse_mode: "HTML" });
    await new Promise(r => setTimeout(r, 700));
    await bot.editMessageText("🎟 Grattage… ⬜⬜🟩", { chat_id: chatId, message_id: m1.message_id });
    await new Promise(r => setTimeout(r, 700));
    await bot.editMessageText("🎟 Grattage… ⬜🟩🟩", { chat_id: chatId, message_id: m1.message_id });
    await new Promise(r => setTimeout(r, 700));

    // apply reward
    const rewardItem = weightedReward(u);
    const res = applyTicketReward(u, rewardItem);

    // log ticket usage
    const u2 = getUser(userId);
    u2.last_ticket_at = nowIso();
    u2.ticket_history = u2.ticket_history || [];
    u2.ticket_history.push({ at: nowIso(), reward: rewardItem.key, label: res.label, details: res.details });
    // keep last 30
    if (u2.ticket_history.length > 30) u2.ticket_history.splice(0, u2.ticket_history.length - 30);
    saveUser(u2);

    await bot.editMessageText(
      `🎉 <b>Gagné !</b>\n\n${res.label}\n<i>${res.details || ""}</i>`,
      { chat_id: chatId, message_id: m1.message_id, parse_mode: "HTML" }
    );

    return;
  }

  // ===== ADMIN PANEL =====
  if (q.data === "admin_panel") {
    if (!isAdmin(from)) return;
    audit("admin_open", from.id, {});
    return editCaptionSafe("🛠 <b>Admin Panel</b>\n\nChoisis une action 👇", adminKeyboard());
  }

  if (q.data === "admin_stats") {
    if (!isAdmin(from)) return;
    return editCaptionSafe(adminStats(), adminKeyboard());
  }

  if (q.data === "admin_orders") {
    if (!isAdmin(from)) return;
    const orders = loadOrders().slice(-15).reverse();
    if (!orders.length) return bot.sendMessage(chatId, "Aucune commande.", { parse_mode: "HTML" });

    const lines = orders.map(o => `• <code>${o.id}</code> — <b>${o.amount.toFixed(2)}€</b> — <b>${o.status}</b> — user <code>${o.userId}</code>`);
    return bot.sendMessage(chatId, `📦 <b>Dernières commandes</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML" });
  }

  if (q.data === "admin_user_lookup") {
    if (!isAdmin(from)) return;
    adminSession.set(String(from.id), { mode: "USER_LOOKUP" });
    return bot.sendMessage(chatId, "🔎 Envoie l’ID ou @username de l’utilisateur à chercher.", { parse_mode: "HTML" });
  }

  if (q.data === "admin_ticket_give") {
    if (!isAdmin(from)) return;
    adminSession.set(String(from.id), { mode: "TICKET_GIVE" });
    return bot.sendMessage(chatId, "🎟 Envoie l’ID de l’utilisateur (ex: 123456) pour lui donner un ticket (reset cooldown).", { parse_mode: "HTML" });
  }

  if (q.data === "admin_discount_create") {
    if (!isAdmin(from)) return;
    adminSession.set(String(from.id), { mode: "DISCOUNT_CREATE" });
    return bot.sendMessage(chatId, "💸 Format: <b>CODE PERCENT JOURS</b>\nEx: <code>CALIDAD20 20 14</code>", { parse_mode: "HTML" });
  }

  if (q.data === "admin_vip_manage") {
    if (!isAdmin(from)) return;
    adminSession.set(String(from.id), { mode: "VIP_MANAGE" });
    return bot.sendMessage(chatId, "⭐ Format: <b>USERID TIER DAYS</b>\nEx: <code>123 BRONZE 30</code>\nTier: BRONZE/SILVER/GOLD/NONE", { parse_mode: "HTML" });
  }

  if (q.data === "admin_broadcast") {
    if (!isAdmin(from)) return;
    return bot.sendMessage(chatId, "📣 Broadcast: choisis une cible 👇", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Tous", callback_data: "admin_broadcast_all" },
            { text: "VIP", callback_data: "admin_broadcast_vip" },
            { text: "Inactifs", callback_data: "admin_broadcast_inactive" }
          ]
        ]
      }
    });
  }

  if (q.data === "admin_broadcast_all" || q.data === "admin_broadcast_vip" || q.data === "admin_broadcast_inactive") {
    if (!isAdmin(from)) return;
    const target = q.data === "admin_broadcast_vip" ? "VIP" : (q.data === "admin_broadcast_inactive" ? "INACTIVE" : "ALL");
    adminSession.set(String(from.id), { mode: "BROADCAST", target });
    return bot.sendMessage(chatId, `📣 Envoie maintenant le message à diffuser.\nCible: <b>${target}</b>`, { parse_mode: "HTML" });
  }

  if (q.data === "admin_cleanup") {
    if (!isAdmin(from)) return;
    const users = loadUsers();
    const now = Date.now();
    const before = Object.keys(users).length;

    // remove users inactive 180 days (example)
    for (const id of Object.keys(users)) {
      const last = new Date(users[id].last_seen_at || 0).getTime();
      if (now - last > 180 * 86400 * 1000) delete users[id];
    }
    saveUsers(users);
    const after = Object.keys(users).length;

    audit("cleanup", from.id, { before, after });
    return bot.sendMessage(chatId, `🧹 Nettoyage terminé.\nAvant: <b>${before}</b>\nAprès: <b>${after}</b>`, { parse_mode: "HTML" });
  }

  if (q.data === "admin_export") {
    if (!isAdmin(from)) return;

    // JSON exports
    await bot.sendDocument(chatId, FILES.users, { caption: "📤 users.json" }).catch(() => {});
    await bot.sendDocument(chatId, FILES.orders, { caption: "📤 orders.json" }).catch(() => {});
    await bot.sendDocument(chatId, FILES.audit, { caption: "📤 audit.json" }).catch(() => {});

    // CSV export for orders (temp file)
    const orders = loadOrders();
    const csv = ["id,userId,amount,status,created_at,updated_at,note"]
      .concat(orders.map(o =>
        [o.id, o.userId, o.amount, o.status, o.created_at, o.updated_at, JSON.stringify(o.note || "")]
          .join(",")
      ))
      .join("\n");

    const tmp = path.join(DATA_DIR, "orders.csv");
    fs.writeFileSync(tmp, csv);
    await bot.sendDocument(chatId, tmp, { caption: "📤 orders.csv" }).catch(() => {});
    return;
  }

  // inline user actions from lookup
  if (q.data.startsWith("admin_block:")) {
    if (!isAdmin(from)) return;
    const id = q.data.split(":")[1];
    setBlocked(id, true, "blocked by admin");
    audit("block_user", from.id, { userId: id });
    return bot.sendMessage(chatId, `🚫 User <code>${id}</code> bloqué.`, { parse_mode: "HTML" });
  }

  if (q.data.startsWith("admin_unblock:")) {
    if (!isAdmin(from)) return;
    const id = q.data.split(":")[1];
    setBlocked(id, false, "unblocked by admin");
    audit("unblock_user", from.id, { userId: id });
    return bot.sendMessage(chatId, `✅ User <code>${id}</code> débloqué.`, { parse_mode: "HTML" });
  }

  if (q.data.startsWith("admin_vip30:") || q.data.startsWith("admin_vip90:")) {
    if (!isAdmin(from)) return;
    const [k, id] = q.data.split(":");
    const days = k.includes("vip90") ? 90 : 30;
    const u = getUser(id);
    if (!u) return bot.sendMessage(chatId, "❌ user introuvable", { parse_mode: "HTML" });

    // default tier BRONZE if none, else keep
    u.vip_tier = u.vip_tier === "NONE" ? "BRONZE" : u.vip_tier;
    const base = vipActive(u) ? new Date(u.vip_until).getTime() : Date.now();
    u.vip_until = new Date(base + days * 86400 * 1000).toISOString();
    saveUser(u);

    audit("vip_extend", from.id, { userId: id, days, tier: u.vip_tier });
    return bot.sendMessage(chatId, `⭐ VIP <b>${u.vip_tier}</b> prolongé de ${days}j pour <code>${id}</code>.`, { parse_mode: "HTML" });
  }

  // If nothing matched, ignore silently
});

/* =========================
   OPTIONAL: Simple Order Creation by command (admin)
   (tu peux enlever si tu veux)
========================= */
bot.onText(/\/neworder (\d+)\s+([0-9.]+)(?:\s+(.+))?$/i, async (msg, m) => {
  if (!isAdmin(msg.from)) return;
  const userId = m[1];
  const amount = Number(m[2]);
  const note = m[3] || "";

  const u = getUser(userId);
  if (!u) return bot.sendMessage(msg.chat.id, "❌ User introuvable", { parse_mode: "HTML" });

  const order = createOrder(userId, amount, note);
  u.orders = u.orders || [];
  u.orders.push(order.id);

  // points: 1€ = 1 pt + vip bonus
  const b = vipBenefits(normalizeVip(u).vip_tier);
  const basePts = Math.floor(amount);
  const bonusPts = Math.floor(basePts * (b.pointsBonusPct / 100));
  u.points = (u.points || 0) + basePts + bonusPts;

  saveUser(u);
  audit("create_order", msg.from.id, { orderId: order.id, userId, amount });

  await bot.sendMessage(msg.chat.id, `✅ Commande créée: <code>${order.id}</code>`, { parse_mode: "HTML" });
  await bot.sendMessage(Number(userId),
    `🧾 <b>Commande créée</b>\n\nID: <code>${order.id}</code>\nMontant: <b>${amount.toFixed(2)}€</b>\nStatut: <b>🕒 en attente</b>`,
    { parse_mode: "HTML" }
  ).catch(() => {});
});

bot.onText(/\/setstatus (CMD-\d+)\s+(\w+)$/i, async (msg, m) => {
  if (!isAdmin(msg.from)) return;
  const orderId = m[1];
  const status = m[2].toLowerCase();
  if (!ORDER_STATUS.includes(status)) {
    return bot.sendMessage(msg.chat.id, `❌ Statut invalide.\nValides: ${ORDER_STATUS.join(", ")}`, { parse_mode: "HTML" });
  }
  const o = setOrderStatus(orderId, status);
  if (!o) return bot.sendMessage(msg.chat.id, "❌ Commande introuvable", { parse_mode: "HTML" });

  audit("set_status", msg.from.id, { orderId, status });
  await bot.sendMessage(msg.chat.id, `✅ Statut mis à jour: <code>${orderId}</code> → <b>${status}</b>`, { parse_mode: "HTML" });
  await notifyOrderStatus(o);
});

/* =========================
   POLLING ERR + SHUTDOWN (Railway)
========================= */
bot.on("polling_error", (err) => {
  console.error("polling_error:", err.message);
});

process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt propre du bot...");
  bot.stopPolling();
  process.exit(0);
});

