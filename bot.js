require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

/* =======================
   CONFIG
======================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant dans .env");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ Bot lancé");

const IMAGE_PATH = path.join(__dirname, "assets", "background.png");

/* =======================
   LIENS
======================= */
const TELEGRAM_CHANNEL = "https://t.me/+GHwxWTV0RoRiZjA0";
const LUFFA_CHANNEL = "https://callup.luffa.im/c/8PiYHFBvV1z";
const SNAPCHAT_URL = "https://snapchat.com/t/mf5ujrdV";
const MINI_APP_URL = "https://duruozan68-jpg.github.io/calidad56-miniapp/";
const CONTACT_URL = "https://t.me/Calidad_Secretaire";

/* =======================
   TEXTES
======================= */
const WELCOME_TEXT = `
💚 BIENVENUE SUR Calidad 🚜

⚠️ Attention : Nos bots et canaux Telegram peuvent être désactivés à tout moment. 🚫⏳

👉🚨 Rejoignez notre canal sur Luffa pour rester connectés en cas de bannissement.
Un nouveau lien officiel y sera toujours publié en priorité.🚨

🔗 Retrouvez tous nos canaux officiels et contactez-nous via les boutons ci-dessous.
`;

const LIVRAISON_TEXT = `
🚚 <b>Livraison - Morbihan</b>

Notre service de livraison couvre <b>tout le Morbihan</b>

⚠️ <b>Un minimum de commande est requis</b> pour valider la livraison.
Contactez-nous pour connaître les conditions et les détails de votre zone.
`;

const MEETUP_TEXT = `
🏠 <b>Meetup - Département 56</b>

Le service de Meetup est disponible uniquement dans le <b>département 56 (Morbihan)</b>.
`;

/* =======================
   PROFIL UTILISATEUR
======================= */
function buildAccountText(user) {
  return `
👤 <b>Mon Profil</b>

• Prénom : <b>${user.first_name || "—"}</b>
• Nom : <b>${user.last_name || "—"}</b>
• Username : <b>${user.username ? "@" + user.username : "Non défini"}</b>

🆔 <b>ID Telegram :</b> <code>${user.id}</code>
`;
}

/* =======================
   CLAVIERS
======================= */

// MENU PRINCIPAL
const mainKeyboard = {
  inline_keyboard: [
    [
      { text: "ℹ️ Informations", callback_data: "info" },
      { text: "📞 Contact", url: CONTACT_URL }
    ],
    [
      { text: "🛒 Calidad Shop", web_app: { url: MINI_APP_URL } }
    ],
    [
      { text: "📢 Canal Telegram", url: TELEGRAM_CHANNEL }
    ],
    [
      { text: "🌐 Canal Luffa", url: LUFFA_CHANNEL },
      { text: "👻 Snapchat", url: SNAPCHAT_URL }
    ],
    [
      {
        text: "🔗 Partager",
        url:
          "https://t.me/share/url?" +
          "url=" + encodeURIComponent(TELEGRAM_CHANNEL) +
          "&text=" + encodeURIComponent(
            "💚 Rejoins nos canaux officiels Calidad 🚜\n\n" +
              "Telegram : " + TELEGRAM_CHANNEL + "\n" +
              "Luffa : " + LUFFA_CHANNEL
          )
      },
      { text: "👤 Mon Compte", callback_data: "account" }
    ]
  ]
};

// MENU INFORMATIONS (avec Secrétaire en dessous)
const infoKeyboard = {
  inline_keyboard: [
    [
      { text: "🚚 Livraison", callback_data: "livraison" },
      { text: "🏠 Meetup", callback_data: "meetup" }
    ],
    [
      { text: "📞 Secrétaire", url: CONTACT_URL }
    ],
    [
      { text: "⬅️ Retour", callback_data: "back_home" }
    ]
  ]
};

const accountKeyboard = {
  inline_keyboard: [
    [{ text: "⬅️ Retour", callback_data: "back_home" }]
  ]
};

/* =======================
   /START
======================= */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    if (fs.existsSync(IMAGE_PATH)) {
      await bot.sendPhoto(chatId, IMAGE_PATH, {
        caption: WELCOME_TEXT,
        parse_mode: "HTML",
        reply_markup: mainKeyboard
      });
    } else {
      await bot.sendMessage(chatId, WELCOME_TEXT, {
        parse_mode: "HTML",
        reply_markup: mainKeyboard
      });
    }
  } catch (err) {
    console.error("❌ Erreur /start :", err.message);
  }
});

/* =======================
   CALLBACKS
======================= */
bot.on("callback_query", async (q) => {
  // Répond vite pour éviter “query too old”
  bot.answerCallbackQuery(q.id).catch(() => {});

  const chatId = q.message.chat.id;
  const messageId = q.message.message_id;

  try {
    if (q.data === "info") {
      await bot.editMessageCaption(
        "ℹ️ <b>Informations</b>\n\nChoisis une option 👇",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: infoKeyboard
        }
      );
    }

    if (q.data === "livraison") {
      await bot.editMessageCaption(LIVRAISON_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: infoKeyboard
      });
    }

    if (q.data === "meetup") {
      await bot.editMessageCaption(MEETUP_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: infoKeyboard
      });
    }

    if (q.data === "account") {
      await bot.editMessageCaption(buildAccountText(q.from), {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: accountKeyboard
      });
    }

    if (q.data === "back_home") {
      await bot.editMessageCaption(WELCOME_TEXT, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: mainKeyboard
      });
    }
  } catch (e) {
    console.error("❌ Callback error:", e.message);
  }
});

