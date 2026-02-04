require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ Bot lancé");

// =======================
// 🖼️ IMAGE
// =======================
const IMAGE_PATH = path.join(__dirname, "assets", "welcome.jpg");

// =======================
// 📝 TEXTE
// =======================
const WELCOME_TEXT = `💚 *BIENVENUE SUR Calidad 🚜*

⚠️ *Attention* : Nos bots et canaux Telegram peuvent être désactivés à tout moment.

👉🚨 *Rejoignez notre canal Luffa* pour rester connectés en cas de bannissement.  
Un nouveau lien officiel y sera toujours publié en priorité.

🔗 Retrouvez tous nos canaux officiels et contactez‑nous via les boutons ci‑dessous.`;

// =======================
// 🧱 MENU PRINCIPAL (COMPLET)
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

      [
        { text: "👻 Snapchat", url: "https://snapchat.com/t/mf5ujrdV" }
      ],

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

// =======================
// ℹ️ SOUS-MENU INFOS
// =======================
const INFO_KEYBOARD = {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🚚 Livraison", callback_data: "LIVRAISON" },
        { text: "🏠 Meetup", callback_data: "MEETUP" }
      ],
      [{ text: "⬅️ Retour", callback_data: "BACK" }]
    ]
  }
};

// =======================
// ▶️ START
// =======================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendPhoto(chatId, IMAGE_PATH, {
    caption: WELCOME_TEXT,
    ...MAIN_KEYBOARD
  });
});

// =======================
// 🔘 ACTIONS
// =======================
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const msgId = q.message.message_id;

  switch (q.data) {
    case "INFO":
      await bot.editMessageText("ℹ️ *Informations Calidad*", {
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
        `🔗 *Partage nos liens officiels* :

📣 Telegram : https://t.me/ton_canal_telegram  
🌐 Luffa : https://luffa.io/ton_canal`,
        { parse_mode: "Markdown" }
      );
      break;

    case "ACCOUNT":
      await bot.sendMessage(
        chatId,
        "👤 *Mon Compte*\n\nFonction bientôt disponible.",
        { parse_mode: "Markdown" }
      );
      break;

    case "BACK":
      await bot.editMessageCaption(WELCOME_TEXT, {
        chat_id: chatId,
        message_id: msgId,
        ...MAIN_KEYBOARD
      });
      break;
  }

  bot.answerCallbackQuery(q.id);
});

