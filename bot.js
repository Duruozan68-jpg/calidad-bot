require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// =======================
// ENV
// =======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ Bot lancé");

// =======================
// PATHS
// =======================
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const ASSETS_DIR = path.join(ROOT, "assets");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const IMAGE_PATH = path.join(ASSETS_DIR, "welcome.jpg");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));

const readJSON = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// =======================
// LIENS (tes infos)
// =======================
const LINKS = {
  telegram: "https://t.me/+GHwxWTV0RoRiZjA0",
  luffa: "https://callup.luffa.im/c/8PiYHFBvV1z",
  snapchat: "https://snapchat.com/t/mf5ujrdV",
  miniapp: "https://duruozan68-jpg.github.io/calidad56-miniapp/?v=1000",
  secretary: "https://t.me/Calidad_Secretaire"
};

const SHARE_URL =
  "https://t.me/share/url?url=" +
  encodeURIComponent(LINKS.telegram) +
  "&text=" +
  encodeURIComponent(
    "💚 Rejoins les canaux officiels Calidad 🚜\n\n" +
      "Telegram : " + LINKS.telegram + "\n" +
      "Luffa : " + LINKS.luffa
  );

// =======================
// USERS
// =======================
function isAdmin(from) {
  return ADMIN_ID && String(from.id) === ADMIN_ID;
}

function upsertUser(from) {
  const users = readJSON(USERS_FILE, {});
  const id = String(from.id);
  if (!users[id]) {
    users[id] = {
      id,
      first_name: from.first_name || "",
      username: from.username || null,
      joined_at: new Date().toISOString()
    };
    writeJSON(USERS_FILE, users);
  }
  return users[id];
}

// =======================
// ORDERS
// =======================
function createOrder({ userId, payload }) {
  const orders = readJSON(ORDERS_FILE, []);
  const orderId = "CMD-" + Date.now();
  const order = {
    id: orderId,
    userId: String(userId),
    status: "en_attente",
    created_at: new Date().toISOString(),
    payload
  };
  orders.push(order);
  writeJSON(ORDERS_FILE, orders);
  return order;
}

function lastOrders(n = 10) {
  const orders = readJSON(ORDERS_FILE, []);
  return orders.slice(-n).reverse();
}

// =======================
// TEXTES
// =======================
const WELCOME_TEXT = `
💚 <b>BIENVENUE SUR Calidad 🚜</b>

⚠️ Attention : Nos bots et canaux Telegram peuvent être désactivés à tout moment.

👉🚨 Rejoins notre canal Luffa pour rester connecté en cas de bannissement.
Un nouveau lien officiel y sera toujours publié en priorité.

🔗 Retrouve nos liens et services ci-dessous.
`.trim();

const INFO_MENU_TEXT = `ℹ️ <b>Informations</b>\n\nChoisis une option 👇`;

const LIVRAISON_TEXT = `
🚚 <b>Livraison - Morbihan</b>

Notre service couvre tout le Morbihan.
⚠️ Un minimum de commande est requis.
`.trim();

const MEETUP_TEXT = `
🏠 <b>Meetup - Département 56</b>

Service disponible uniquement dans le Morbihan.
`.trim();

// =======================
// CLAVIERS (ordre demandé)
// =======================
const MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "ℹ️ Informations", callback_data: "info" },
      { text: "📞 Contact", url: LINKS.secretary }
    ],
    [{ text: "🛒 Calidad Shop", web_app: { url: LINKS.miniapp } }],
    [{ text: "📢 Canal Telegram", url: LINKS.telegram }],
    [
      { text: "🌐 Canal Luffa", url: LINKS.luffa },
      { text: "👻 Snapchat", url: LINKS.snapchat }
    ],
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
  const rows = [];
  if (isAdmin(from)) rows.push([{ text: "🛠 Admin Panel", callback_data: "admin" }]);
  rows.push([{ text: "⬅️ Retour", callback_data: "back_home" }]);
  return { inline_keyboard: rows };
}

// =======================
// /start
// =======================
bot.onText(/\/start/, async (msg) => {
  upsertUser(msg.from);
  try {
    await bot.sendPhoto(msg.chat.id, IMAGE_PATH, {
      caption: WELCOME_TEXT,
      parse_mode: "HTML",
      reply_markup: MAIN_KEYBOARD
    });
  } catch {
    await bot.sendMessage(msg.chat.id, WELCOME_TEXT, {
      parse_mode: "HTML",
      reply_markup: MAIN_KEYBOARD
    });
  }
});

// =======================
// WebApp Orders (sendData)
// =======================
// Telegram envoie un message avec msg.web_app_data.data
bot.on("message", async (msg) => {
  if (!msg.web_app_data || !msg.web_app_data.data) return;

  upsertUser(msg.from);

  let payload;
  try {
    payload = JSON.parse(msg.web_app_data.data);
  } catch {
    return bot.sendMessage(msg.chat.id, "❌ Données WebApp invalides.");
  }

  // Vérif basique
  if (!payload || payload.type !== "ORDER" || !Array.isArray(payload.items)) {
    return bot.sendMessage(msg.chat.id, "❌ Format commande invalide.");
  }

  const order = createOrder({ userId: msg.from.id, payload });

  // Récap
  const lines = payload.items.map(
    (it) => `• ${it.name} x${it.qty} — ${Number(it.line).toFixed(2)}€`
  );

  const recap =
    `✅ <b>Commande reçue</b>\n\n` +
    `ID : <code>${order.id}</code>\n` +
    `Mode : <b>${payload.mode || "—"}</b>\n` +
    `Total : <b>${Number(payload.total || 0).toFixed(2)}€</b>\n\n` +
    `<b>Détails</b>\n${lines.join("\n")}` +
    (payload.note ? `\n\n📝 Note : <i>${payload.note}</i>` : "") +
    `\n\n📌 Statut : <b>🕒 en attente</b>`;

  await bot.sendMessage(msg.chat.id, recap, { parse_mode: "HTML" });

  // Notif admin (si configuré)
  if (ADMIN_ID) {
    await bot.sendMessage(
      Number(ADMIN_ID),
      `🆕 <b>Nouvelle commande</b>\nID: <code>${order.id}</code>\nUser: <code>${msg.from.id}</code>\nTotal: <b>${Number(payload.total || 0).toFixed(2)}€</b>`,
      { parse_mode: "HTML" }
    ).catch(() => {});
  }
});

// =======================
// CALLBACKS
// =======================
bot.on("callback_query", async (q) => {
  bot.answerCallbackQuery(q.id).catch(() => {});
  const chatId = q.message.chat.id;
  const msgId = q.message.message_id;

  upsertUser(q.from);

  const edit = (text, kb) =>
    bot.editMessageCaption(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: "HTML",
      reply_markup: kb
    });

  if (q.data === "back_home") return edit(WELCOME_TEXT, MAIN_KEYBOARD);
  if (q.data === "info") return edit(INFO_MENU_TEXT, INFO_KEYBOARD);
  if (q.data === "livraison") return edit(LIVRAISON_TEXT, INFO_KEYBOARD);
  if (q.data === "meetup") return edit(MEETUP_TEXT, INFO_KEYBOARD);

  if (q.data === "account") {
    const u = upsertUser(q.from);
    const txt =
      `👤 <b>Mon Compte</b>\n\n` +
      `• Nom : <b>${u.first_name || "—"}</b>\n` +
      `• Username : <b>${u.username ? "@" + u.username : "—"}</b>\n` +
      `• ID : <code>${u.id}</code>\n\n` +
      `🛒 Shop : bouton “Calidad Shop”\n` +
      `📦 Les commandes viennent de la mini‑app.`;

    return edit(txt, accountKeyboard(q.from));
  }

  if (q.data === "admin") {
    if (!isAdmin(q.from)) return;
    const orders = lastOrders(8);
    const lines = orders.length
      ? orders.map(o => `• <code>${o.id}</code> — <b>${o.status}</b> — user <code>${o.userId}</code>`).join("\n")
      : "Aucune commande.";

    return bot.sendMessage(
      chatId,
      `🛠 <b>Admin Panel</b>\n\n<b>Dernières commandes</b>\n${lines}\n\nCommandes utiles:\n<code>/start</code>`,
      { parse_mode: "HTML" }
    );
  }
});

// =======================
// SHUTDOWN Railway
// =======================
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt propre");
  bot.stopPolling();
  process.exit(0);
});

bot.on("polling_error", (err) => {
  console.error("polling_error:", err.message);
});

