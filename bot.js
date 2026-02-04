require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// =======================
// 🔐 ENV (Railway)
// =======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

// =======================
// 🤖 BOT INIT
// =======================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ Bot lancé");

// =======================
// 🔗 LIENS (ceux que tu as fournis)
// =======================
const TELEGRAM_CHANNEL = "https://t.me/+GHwxWTV0RoRiZjA0";
const LUFFA_CHANNEL = "https://callup.luffa.im/c/8PiYHFBvV1z";
const SNAPCHAT_URL = "https://snapchat.com/t/mf5ujrdV";
const MINI_APP_URL = "https://duruozan68-jpg.github.io/calidad56-miniapp/";
const CONTACT_URL = "https://t.me/Calidad_Secretaire";

// =======================
// 🖼️ IMAGE
// =======================
const IMAGE_PATH = path.join(__dirname, "assets", "welcome.jpg");

// =======================
// 💾 USERS STORAGE
// =======================
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
}
ensureDataFiles();

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
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

function bumpClick(from) {
  const users = loadUsers();
  const id = String(from.id);
  if (users[id]) {
    users[id].clicks = (users[id].clicks || 0) + 1;
    users[id].last_seen_at = new Date().toISOString();
    saveUsers(users);
  }
}

function isAdmin(from) {
  return ADMIN_ID && String(from.id) === String(ADMIN_ID);
}

// =======================
// 📝 TEXTES
// =======================
const WELCOME_TEXT = `
💚 <b>BIENVENUE SUR Calidad 🚜</b>

⚠️ Attention : Nos bots et canaux Telegram peuvent être désactivés à tout moment. 🚫⏳

👉🚨 Rejoignez notre canal sur Luffa pour rester connectés en cas de bannissement.
Un nouveau lien officiel y sera toujours publié en priorité. 🚨

🔗 Retrouvez tous nos canaux officiels et services ci‑dessous.
`.trim();

const INFO_MENU_TEXT = `ℹ️ <b>Informations</b>\n\nSélectionnez une option 👇`;

const LIVRAISON_TEXT = `
🚚 <b>Livraison - Morbihan</b>

Notre service de livraison couvre <b>tout le Morbihan</b>.

⚠️ <b>Un minimum de commande est requis</b> pour valider la livraison.
Contactez-nous pour connaître les conditions et les détails de votre zone.
`.trim();

const MEETUP_TEXT = `
🏠 <b>Meetup - Département 56</b>

Le service de Meetup est disponible uniquement dans le
<b>département 56 (Morbihan)</b>.
`.trim();

function accountText(u, admin) {
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || "—";
  const joined = u.joined_at ? new Date(u.joined_at).toLocaleDateString() : "—";
  const lastSeen = u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : "—";
  return `
👤 <b>Mon Compte</b>

• Nom : <b>${fullName}</b>
• Username : <b>${u.username ? "@" + u.username : "Non défini"}</b>
• ID Telegram : <code>${u.id}</code>

📅 Inscrit le : <b>${joined}</b>
🕒 Dernière activité : <b>${lastSeen}</b>
📌 Interactions : <b>${u.clicks || 0}</b>

🛡 Admin : <b>${admin ? "Oui" : "Non"}</b>
`.trim();
}

// =======================
// 🔗 SHARE URL (pré-rempli)
// =======================
const SHARE_URL =
  "https://t.me/share/url?" +
  "url=" +
  encodeURIComponent(TELEGRAM_CHANNEL) +
  "&text=" +
  encodeURIComponent(
    "💚 Rejoins les canaux officiels Calidad 🚜\n\n" +
      "Telegram : " + TELEGRAM_CHANNEL + "\n" +
      "Luffa : " + LUFFA_CHANNEL
  );

// =======================
// 🧱 CLAVIERS (ordre demandé)
// =======================
const MAIN_KEYBOARD = {
  inline_keyboard: [
    // Ligne 1 : Infos gauche / Contact droite
    [
      { text: "ℹ️ Informations", callback_data: "info" },
      { text: "📞 Contact", url: CONTACT_URL }
    ],
    // Ligne 2 : Calidad Shop (mini app)
    [{ text: "🛒 Calidad Shop", web_app: { url: MINI_APP_URL } }],
    // Ligne 3 : Canal Telegram
    [{ text: "📢 Canal Telegram", url: TELEGRAM_CHANNEL }],
    // Ligne 4 : Luffa gauche / Snapchat droite
    [
      { text: "🌐 Canal Luffa", url: LUFFA_CHANNEL },
      { text: "👻 Snapchat", url: SNAPCHAT_URL }
    ],
    // Ligne 5 : Mon Compte gauche / Partager droite (partager bottom right)
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
    [{ text: "📞 Secrétaire", url: CONTACT_URL }],
    [{ text: "⬅️ Retour", callback_data: "back_home" }]
  ]
};

function accountKeyboard(admin) {
  const rows = [];
  if (admin) rows.push([{ text: "🛠 Admin Panel", callback_data: "admin_panel" }]);
  rows.push([{ text: "⬅️ Retour", callback_data: "back_home" }]);
  return { inline_keyboard: rows };
}

// =======================
// 🛠 ADMIN PANEL (callbacks + broadcast flow)
// =======================
const adminState = {
  waitingBroadcast: false
};

const ADMIN_PANEL_TEXT = `🛠 <b>Admin Panel</b>\n\nChoisis une action 👇`;

const ADMIN_KEYBOARD = {
  inline_keyboard: [
    [{ text: "📊 Stats", callback_data: "admin_stats" }],
    [{ text: "📣 Broadcast", callback_data: "admin_broadcast" }],
    [{ text: "📤 Export users.json", callback_data: "admin_export" }],
    [{ text: "♻️ Reset users", callback_data: "admin_reset_confirm" }],
    [{ text: "⬅️ Retour", callback_data: "account" }]
  ]
};

const ADMIN_RESET_CONFIRM_TEXT =
  "⚠️ <b>Confirmation</b>\n\nTu veux vraiment <b>supprimer tous les utilisateurs</b> ?";

const ADMIN_RESET_CONFIRM_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "✅ Oui, reset", callback_data: "admin_reset_do" },
      { text: "❌ Annuler", callback_data: "admin_panel" }
    ]
  ]
};

function adminStatsText() {
  const users = loadUsers();
  const ids = Object.keys(users);
  const total = ids.length;
  let active7d = 0;
  const now = Date.now();

  for (const id of ids) {
    const last = users[id].last_seen_at ? new Date(users[id].last_seen_at).getTime() : 0;
    if (now - last <= 7 * 24 * 60 * 60 * 1000) active7d++;
  }

  return `📊 <b>Stats</b>\n\n👥 Utilisateurs : <b>${total}</b>\n🟢 Actifs (7 jours) : <b>${active7d}</b>`;
}

// =======================
// ▶️ /start
// =======================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  upsertUser(msg.from);

  try {
    await bot.sendPhoto(chatId, IMAGE_PATH, {
      caption: WELCOME_TEXT,
      parse_mode: "HTML",
      reply_markup: MAIN_KEYBOARD
    });
  } catch (err) {
    console.error("❌ sendPhoto:", err.message);
    await bot.sendMessage(chatId, WELCOME_TEXT, {
      parse_mode: "HTML",
      reply_markup: MAIN_KEYBOARD
    });
  }
});

// =======================
// 📣 Broadcast (admin écrit un message après avoir cliqué)
// =======================
bot.on("message", async (msg) => {
  // Ignore les commandes
  if (!msg.text) return;
  if (msg.text.startsWith("/")) return;

  if (adminState.waitingBroadcast && isAdmin(msg.from)) {
    adminState.waitingBroadcast = false;

    const users = loadUsers();
    const ids = Object.keys(users);

    let ok = 0;
    let fail = 0;

    for (const id of ids) {
      try {
        await bot.sendMessage(Number(id), msg.text, { parse_mode: "HTML" }).catch(() => {
          // si HTML casse, tente sans parse_mode
          return bot.sendMessage(Number(id), msg.text);
        });
        ok++;
      } catch {
        fail++;
      }
    }

    await bot.sendMessage(
      msg.chat.id,
      `✅ <b>Broadcast terminé</b>\n\nEnvoyé : <b>${ok}</b>\nÉchecs : <b>${fail}</b>`,
      { parse_mode: "HTML" }
    );
  }
});

// =======================
// 🔘 CALLBACKS
// =======================
bot.on("callback_query", async (q) => {
  // ✅ répondre vite pour éviter “query too old”
  bot.answerCallbackQuery(q.id).catch(() => {});

  const chatId = q.message.chat.id;
  const messageId = q.message.message_id;

  // Toujours upsert + clicks
  upsertUser(q.from);
  bumpClick(q.from);

  try {
    // Menu principal
    if (q.data === "back_home") {
      await bot.editMessageCaption(WELCOME_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: MAIN_KEYBOARD
      });
      return;
    }

    // Infos
    if (q.data === "info") {
      await bot.editMessageCaption(INFO_MENU_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: INFO_KEYBOARD
      });
      return;
    }

    if (q.data === "livraison") {
      await bot.editMessageCaption(LIVRAISON_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: INFO_KEYBOARD
      });
      return;
    }

    if (q.data === "meetup") {
      await bot.editMessageCaption(MEETUP_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: INFO_KEYBOARD
      });
      return;
    }

    // Mon Compte
    if (q.data === "account") {
      const users = loadUsers();
      const u = users[String(q.from.id)] || upsertUser(q.from);
      const admin = isAdmin(q.from);

      await bot.editMessageCaption(accountText(u, admin), {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: accountKeyboard(admin)
      });
      return;
    }

    // Admin Panel (uniquement admin)
    if (q.data === "admin_panel") {
      if (!isAdmin(q.from)) return;

      await bot.editMessageCaption(ADMIN_PANEL_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: ADMIN_KEYBOARD
      });
      return;
    }

    if (q.data === "admin_stats") {
      if (!isAdmin(q.from)) return;

      await bot.editMessageCaption(adminStatsText(), {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: ADMIN_KEYBOARD
      });
      return;
    }

    if (q.data === "admin_export") {
      if (!isAdmin(q.from)) return;

      // Envoie le fichier users.json
      await bot.sendDocument(chatId, USERS_FILE, {
        caption: "📤 Export users.json",
        parse_mode: "HTML"
      });
      return;
    }

    if (q.data === "admin_broadcast") {
      if (!isAdmin(q.from)) return;

      adminState.waitingBroadcast = true;

      await bot.sendMessage(
        chatId,
        "📣 <b>Broadcast</b>\n\nEnvoie maintenant le message à diffuser à <b>tous</b> les utilisateurs.\n(Le prochain message sera envoyé à tout le monde.)",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (q.data === "admin_reset_confirm") {
      if (!isAdmin(q.from)) return;

      await bot.editMessageCaption(ADMIN_RESET_CONFIRM_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: ADMIN_RESET_CONFIRM_KEYBOARD
      });
      return;
    }

    if (q.data === "admin_reset_do") {
      if (!isAdmin(q.from)) return;

      saveUsers({});
      await bot.editMessageCaption("♻️ <b>Reset terminé</b>\n\nTous les utilisateurs ont été supprimés.", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: ADMIN_KEYBOARD
      });
      return;
    }
  } catch (err) {
    console.error("❌ Callback error:", err.message);
  }
});

// =======================
// 🛑 GRACEFUL SHUTDOWN (Railway)
// =======================
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt propre du bot...");
  bot.stopPolling();
  process.exit(0);
});

bot.on("polling_error", (err) => {
  console.error("polling_error:", err.message);
});

