require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// =======================
// 🔐 VARIABLES RAILWAY
// =======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

// =======================
// 🤖 INIT BOT
// =======================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("✅ Bot lancé");

// =======================
// 🟢 MESSAGE BIENVENUE
// =======================
const WELCOME_MESSAGE = `💚 *BIENVENUE SUR Calidad 🚜*

⚠️ *Attention* : Nos bots et canaux Telegram peuvent être désactivés à tout moment.

👉🚨 *Rejoignez notre canal Luffa* pour rester connectés en cas de bannissement.
Un nouveau lien officiel y sera toujours publié en priorité.

🔗 Retrouvez tous nos canaux officiels via les boutons ci‑dessous.`;

// =======================
// 🧭 CLAVIERS
// =======================
const mainKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🛒 Calidad Shop", url: "https://ton-miniapp-link.com" }
      ],
      [
        { text: "📣 Canal Telegram", url: "https://t.me/ton_canal_telegram" },
        { text: "📣 Canal Luffa", url: "https://luffa.io/ton_canal" }
      ],
      [
        { text: "👻 Snapchat", url: "https://snapchat.com/t/mf5ujrdV" }
      ],
      [
        { text: "ℹ️ Information", callback_data: "INFO_MENU" }
      ]
    ]
  },
  parse_mode: "Markdown"
};

const infoKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🚚 Livraison", callback_data: "INFO_LIVRAISON" },
        { text: "🏠 Meetup", callback_data: "INFO_MEETUP" }
      ],
      [
        { text: "📞 Secrétaire", url: "https://t.me/ton_secretaire" }
      ],
      [
        { text: "⬅️ Retour", callback_data: "BACK_HOME" }
      ]
    ]
  },
  parse_mode: "Markdown"
};

// =======================
// ▶️ /start
// =======================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, mainKeyboard);
});

// =======================
// 🔘 CALLBACKS
// =======================
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;

  switch (query.data) {
    case "INFO_MENU":
      bot.editMessageText("ℹ️ *Informations Calidad*", {
        chat_id: chatId,
        message_id: query.message.message_id,
        ...infoKeyboard
      });
      break;

    case "INFO_LIVRAISON":
      bot.sendMessage(
        chatId,
        `🚚 *Livraison - Morbihan*

Notre service de livraison couvre tout le Morbihan.

⚠️ Un minimum de commande est requis.
Contactez‑nous pour connaître les conditions.`,
        { parse_mode: "Markdown" }
      );
      break;

    case "INFO_MEETUP":
      bot.sendMessage(
        chatId,
        `🏠 *Meetup - Département 56*

Le service Meetup est disponible uniquement dans le Morbihan.`,
        { parse_mode: "Markdown" }
      );
      break;

    case "BACK_HOME":
      bot.editMessageText(WELCOME_MESSAGE, {
        chat_id: chatId,
        message_id: query.message.message_id,
        ...mainKeyboard
      });
      break;
  }

  bot.answerCallbackQuery(query.id);
});

// =======================
// 🛑 ERREURS
// =======================
bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

