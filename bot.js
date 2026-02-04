require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const fs = require("fs");

// =======================
// 🔐 ENV
// =======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID || null;

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
// 🖼️ IMAGE
// =======================
const IMAGE_PATH = path.join(__dirname, "assets", "welcome.jpg");

// =======================
// 💾 DATA USERS
// =======================
const USERS_FILE = path.join(__dirname, "data", "users.json");

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function ensureUser(user) {
  const users = loadUsers();
  if (!users[user.id]) {
    users[user.id] = {
      id: user.id,
      first_name: user.first_name || "",
      username: user.username || null,
      joined_at: new Date().toISOString(),
      is_admin: ADMIN_ID && String(user.id) === String(ADMIN_ID)
    };
    saveUsers(users);
  }
  return users[user.id];
}

// =======================
// 📝 TEXTES
// =======================
const WELCOME_TEXT = `💚 *BIENVENUE SUR Calidad 🚜*

⚠️ *Attention* : Nos bots et canaux Telegram peuvent être désactivés à tout moment.

👉🚨 *Rejoignez notre canal Luffa* pour rester connectés en cas de bannissement.
Un nouveau lien officiel y sera toujours publié en priorité.

🔗 Retrouvez tous nos services via les boutons ci‑dessous.`;

// =======================
// 🧱 CLAVIERS
// =======================
const MAIN_KEYBOARD = {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{ text: "🛒 Calidad Shop", url: "https://ton-miniapp-link.com" }],
      [
        { text: "📣 Canal Telegram", url: "https://t.me/ton_canal_telegram" },
        { text: "🌐 Canal Luffa", url: "https://luffa.io/ton_canal" }
      ],
      [{ text: "👻 Snapchat", url: "https://snapchat.com/t/mf5ujrdV" }],
      [
        { text: "ℹ️ Informations", callback_data: "INFO" },
        { text: "📞 Contact", url: "https://t.me/ton_secretaire" }
      ],
      [
        { text: "🔗 Partager", callback_data: "SHARE" },
        { text: "👤 Mon Compte", callback_data: "ACCOUNT" }
      ]
    ]
  }
};

const INFO_KEYBOARD = {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🚚 Livraison", callback_data: "LIVRAISON" },
        { text: "🏠 Meetup", callback_data: "MEETUP" }
      ],
      [{ text: "⬅️ Retour", callback_data: "BACK_HOME" }]
    ]
  }
};

// =======================
// ▶️ /start
// =======================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  ensureUser(msg.from);

  try {
    await bot.sendPhoto(chatId, IMAGE_PATH, {
      caption: WELCOME_TEXT,
      ...MAIN_KEYBOARD
    });
  } catch {
    await bot.sendMessage(chatId, WELCOME_TEXT, MAIN_KEYBOARD);
  }
});

// =======================
// 🔘 CALLBACKS
// =======================
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const msgId = q.message.message_id;

  try {
    switch (q.data) {
      case "INFO":
        await bot.editMessageCaption("ℹ️ *Informations Calidad*", {
          chat_id: chatId,
          message_id: msgId,
          ...INFO_KEYBOARD
        });
        break;

      case "LIVRAISON":
        await bot.sendMessage(
          chatId,
          `🚚 *Livraison – Morbihan*

Notre service couvre tout le département 56.
⚠️ Un minimum de commande est requis.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "MEETUP":
        await bot.sendMessage(
          chatId,
          `🏠 *Meetup – Département 56*

Service disponible uniquement dans le Morbihan.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "SHARE":
        await bot.sendMessage(
          chatId,
          `🔗 *Liens officiels Calidad*

📣 Telegram : https://t.me/ton_canal_telegram
🌐 Luffa : https://luffa.io/ton_canal`,
          { parse_mode: "Markdown" }
        );
        break;

      case "ACCOUNT": {
        const user = ensureUser(q.from);
        await bot.sendMessage(
          chatId,
          `👤 *Mon Compte*

🆔 ID : \`${user.id}\`
👋 Prénom : ${user.first_name}
👤 Username : ${user.username || "—"}
📅 Inscrit le : ${new Date(user.joined_at).toLocaleDateString()}
🛡 Admin : ${user.is_admin ? "Oui" : "Non"}`,
          { parse_mode: "Markdown" }
        );
        break;
      }

      case "BACK_HOME":
        await bot.editMessageCaption(WELCOME_TEXT, {
          chat_id: chatId,
          message_id: msgId,
          ...MAIN_KEYBOARD
        });
        break;
    }
  } catch (err) {
    console.error("Callback error:", err.message);
  }

  bot.answerCallbackQuery(q.id);
});

// =======================
// 🛑 GRACEFUL SHUTDOWN
// =======================
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt propre");
  bot.stopPolling();
  process.exit(0);
});

