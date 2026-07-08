// index.js
// Avto Chat Bot — ko'p foydalanuvchili, freemium modeldagi Telegram bot.

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { loadData, saveData } = require('./storage');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("XATOLIK: BOT_TOKEN topilmadi.");
  process.exit(1);
}

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const ADMIN_USERNAME = '@Javoh_1hacker';

// Sozlamalar
const CARD_NUMBER = '6262570040359129';
const PREMIUM_PRICE = 19000;
const PREMIUM_DAYS = 30;
const FREE_LIMIT = 2;

const bot = new Telegraf(BOT_TOKEN);

// --- Yordamchi funksiyalar -------------------------------------------------

function isAdmin(ctx) {
  const id = String(ctx.from?.id);
  return ADMIN_IDS.length === 0 ? true : ADMIN_IDS.includes(id);
}

function hasPremium(user) {
  if (!user.premiumUntil) return false;
  return new Date(user.premiumUntil) > new Date();
}

function touchUser(data, userId, from) {
  const now = new Date().toISOString();
  if (!data.users[userId]) {
    data.users[userId] = {
      id: userId,
      username: from?.username || '',
      firstName: from?.first_name || '',
      firstSeen: now,
      lastSeen: now,
      keywords: [], // { id, keyword, answer }
      state: null,
      isPremium: false,
      premiumUntil: null
    };
  }
  data.users[userId].lastSeen = now;
}

// Tugmalar
function userKeyboard(ctx) {
  const kb = [
    ['🔑 Mening kalit so\'zlarim', '💎 Premium sotib olish'],
    ['🏠 Kabinet']
  ];
  if (isAdmin(ctx)) {
    kb.push(['👑 Admin panel']);
  }
  return Markup.keyboard(kb).resize();
}

function adminKeyboard() {
  return Markup.keyboard([
    ['📊 Statistika', '📢 Xabar yuborish'],
    ['💎 Premium berish', '🔙 Asosiy menyu']
  ]).resize();
}

// --- Buyruqlar ---------------------------------------------------------

bot.start((ctx) => {
  const data = loadData();
  const userId = String(ctx.from.id);
  touchUser(data, userId, ctx.from);
  data.users[userId].state = null; // Holatni tozalash
  saveData(data);

  ctx.reply(
    `Assalomu alaykum, ${ctx.from.first_name}!\n\n` +
    `Avto Chat Botga xush kelibsiz. Bu bot orqali Telegram Business akkauntingizga kelgan xabarlarga avtomatik javob berishingiz mumkin.\n\n` +
    `Bepul tarifda siz ${FREE_LIMIT} ta kalit so'z qo'sha olasiz. Premium tarifda esa cheklovlar yo'q.`,
    userKeyboard(ctx)
  );
});

// --- Asosiy Menyular ----------------------------------------------------

bot.hears('🔙 Asosiy menyu', (ctx) => {
  const data = loadData();
  const userId = String(ctx.from.id);
  touchUser(data, userId, ctx.from);
  data.users[userId].state = null;
  saveData(data);
  ctx.reply('Asosiy menyuga qaytdingiz.', userKeyboard(ctx));
});

bot.hears('🏠 Kabinet', (ctx) => {
  const data = loadData();
  const userId = String(ctx.from.id);
  touchUser(data, userId, ctx.from);
  const user = data.users[userId];
  
  const premiumStatus = hasPremium(user) 
    ? `Faol (Gacha: ${new Date(user.premiumUntil).toLocaleDateString('uz-UZ')})` 
    : 'Mavjud emas';

  ctx.reply(
    `👤 Kabinet\n\n` +
    `🆔 ID: ${user.id}\n` +
    `💎 Premium: ${premiumStatus}\n` +
    `🔑 Saqlangan kalit so'zlar: ${user.keywords.length} ta`
  );
});

// --- Kalit So'zlar Tizimi -----------------------------------------------

bot.hears('🔑 Mening kalit so\'zlarim', (ctx) => {
  const data = loadData();
  const userId = String(ctx.from.id);
  touchUser(data, userId, ctx.from);
  const user = data.users[userId];
  user.state = null;
  saveData(data);

  let text = `Sizning kalit so'zlaringiz (${user.keywords.length} ta):\n\n`;
  if (user.keywords.length === 0) {
    text += "Hozircha kalit so'zlar kiritilmagan.";
  } else {
    user.keywords.forEach((k, i) => {
      text += `${i + 1}. 🔑 ${k.keyword}\n   📝 ${k.answer}\n\n`;
    });
  }

  ctx.reply(text, Markup.inlineKeyboard([
    [Markup.button.callback('➕ Yangi qo\'shish', 'add_keyword')],
    [Markup.button.callback('🗑 O\'chirish', 'delete_keyword')]
  ]));
});

bot.action('add_keyword', (ctx) => {
  const data = loadData();
  const userId = String(ctx.from.id);
  const user = data.users[userId];

  if (!hasPremium(user) && user.keywords.length >= FREE_LIMIT) {
    return ctx.reply(`⚠️ Bepul tarifda faqat ${FREE_LIMIT} ta kalit so'z qo'shish mumkin. Cheklovni olib tashlash uchun Premium sotib oling.`);
  }

  user.state = 'awaiting_new_keyword';
  saveData(data);
  ctx.reply('Yangi kalit so\'zni yuboring:');
  ctx.answerCbQuery();
});

bot.action('delete_keyword', (ctx) => {
  const data = loadData();
  const user = data.users[String(ctx.from.id)];
  
  if (user.keywords.length === 0) {
    return ctx.answerCbQuery('O\'chirish uchun so\'zlar yo\'q.', { show_alert: true });
  }

  const buttons = user.keywords.map(k => [Markup.button.callback(`❌ ${k.keyword}`, `del_kw_${k.id}`)]);
  ctx.reply('O\'chirmoqchi bo\'lgan kalit so\'zni tanlang:', Markup.inlineKeyboard(buttons));
  ctx.answerCbQuery();
});

bot.action(/del_kw_(.+)/, (ctx) => {
  const id = ctx.match[1];
  const data = loadData();
  const user = data.users[String(ctx.from.id)];
  
  user.keywords = user.keywords.filter(k => k.id !== id);
  saveData(data);
  
  ctx.editMessageText('✅ Kalit so\'z o\'chirildi.');
  ctx.answerCbQuery();
});

// --- To'lov va Premium (Foydalanuvchi qismi) ----------------------------

bot.hears('💎 Premium sotib olish', (ctx) => {
  const data = loadData();
  const userId = String(ctx.from.id);
  const user = data.users[userId];

  if (hasPremium(user)) {
    return ctx.reply(`Sizda allaqachon Premium mavjud! Uning muddati ${new Date(user.premiumUntil).toLocaleDateString('uz-UZ')} gacha.`);
  }

  user.state = 'awaiting_receipt';
  saveData(data);

  ctx.reply(
    `💳 To'lov qilish uchun:\n\n` +
    `Karta raqami: ${CARD_NUMBER}\n` +
    `💰 Summa: ${PREMIUM_PRICE.toLocaleString('uz-UZ')} so'm\n` +
    `🆔 Telegram ID: ${userId}\n\n` +
    `✅ To'lovni amalga oshirgach, chek rasmini (screenshot) shu yerga yuboring.`
  );
});

bot.on('photo', (ctx) => {
  const data = loadData();
  const userId = String(ctx.from.id);
  const user = data.users[userId];

  if (user.state === 'awaiting_receipt') {
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    
    // Adminlarga yuborish
    ADMIN_IDS.forEach(adminId => {
      bot.telegram.sendPhoto(adminId, photoId, {
        caption: `💳 YANGI CHEK KELDI\n\n👤 Foydalanuvchi: ${ctx.from.first_name}\n🔗 Lichkasi: @${ctx.from.username || 'yoq'}\n🆔 ID: ${userId}\n💰 Kutilgan summa: ${PREMIUM_PRICE} so'm`,
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback('✅ Tasdiqlash', `approve_${userId}`),
              Markup.button.callback('❌ Rad etish', `reject_${userId}`)
            ]
          ]
        }
      }).catch(err => console.error("Adminga xabar bormadi:", err));
    });

    user.state = null;
    saveData(data);
    return ctx.reply('⏳ Chek tekshirilmoqda...\n\nJarayon 24 soatgacha vaqt olishi mumkin. Savollar bo\'lsa admin bilan bog\'laning: ' + ADMIN_USERNAME);
  }
});

// --- Admin Panel ---------------------------------------------------------

bot.hears('👑 Admin panel', (ctx) => {
  if (!isAdmin(ctx)) return;
  ctx.reply('Admin panelga xush kelibsiz.', adminKeyboard());
});

bot.hears('📊 Statistika', (ctx) => {
  if (!isAdmin(ctx)) return;
  const data = loadData();
  const users = Object.values(data.users);
  const premiumUsers = users.filter(hasPremium).length;
  
  ctx.reply(
    `📊 Statistika\n\n` +
    `👥 Jami foydalanuvchilar: ${users.length} ta\n` +
    `💎 Premium foydalanuvchilar: ${premiumUsers} ta\n` +
    `💬 Jami avto-javoblar: ${data.stats?.autoRepliedMessages || 0} ta`
  );
});

bot.hears('📢 Xabar yuborish', (ctx) => {
  if (!isAdmin(ctx)) return;
  const data = loadData();
  const userId = String(ctx.from.id);
  data.users[userId].state = 'admin_broadcast';
  saveData(data);
  ctx.reply('Barcha foydalanuvchilarga yuboriladigan xabar matnini kiriting:');
});

bot.hears('💎 Premium berish', (ctx) => {
  if (!isAdmin(ctx)) return;
  const data = loadData();
  const userId = String(ctx.from.id);
  data.users[userId].state = 'admin_give_premium';
  saveData(data);
  ctx.reply('Premium bermoqchi bo\'lgan foydalanuvchining Telegram ID raqamini kiriting:');
});

// Chekni tasdiqlash/rad etish
bot.action(/approve_(.+)/, (ctx) => {
  if (!isAdmin(ctx)) return;
  const targetId = ctx.match[1];
  const data = loadData();
  
  if (data.users[targetId]) {
    const until = new Date();
    until.setDate(until.getDate() + PREMIUM_DAYS);
    data.users[targetId].isPremium = true;
    data.users[targetId].premiumUntil = until.toISOString();
    saveData(data);

    bot.telegram.sendMessage(targetId, `✅ Tabriklaymiz! To'lovingiz tasdiqlandi va sizga ${PREMIUM_DAYS} kunlik Premium taqdim etildi.`).catch(console.error);
    ctx.editMessageCaption(`✅ Tasdiqlandi (ID: ${targetId})`);
  } else {
    ctx.answerCbQuery('Foydalanuvchi topilmadi.', { show_alert: true });
  }
});

bot.action(/reject_(.+)/, (ctx) => {
  if (!isAdmin(ctx)) return;
  const targetId = ctx.match[1];
  
  bot.telegram.sendMessage(targetId, `❌ Kechirasiz, siz yuborgan chek tasdiqlanmadi.\nIltimos admin bilan bog'laning: ${ADMIN_USERNAME}`).catch(console.error);
  ctx.editMessageCaption(`❌ Rad etildi (ID: ${targetId})`);
});

// --- Matnli xabarlarni qayta ishlash (State manager) ---------------------

bot.on('text', async (ctx) => {
  if (ctx.update.business_message) return; // Business xabarlar alohida ushlanadi

  const text = ctx.message.text.trim();
  const userId = String(ctx.from.id);
  const data = loadData();
  touchUser(data, userId, ctx.from);
  const user = data.users[userId];

  // Oddiy menyular ziddiyatini oldini olish
  const ignoreTexts = ['🔙 Asosiy menyu', '👑 Admin panel', '🔑 Mening kalit so\'zlarim', '💎 Premium sotib olish', '🏠 Kabinet', '📊 Statistika', '📢 Xabar yuborish', '💎 Premium berish'];
  if (ignoreTexts.includes(text)) return;

  // Foydalanuvchi holatlari
  if (user.state === 'awaiting_new_keyword') {
    user.tempKeyword = text;
    user.state = 'awaiting_new_answer';
    saveData(data);
    return ctx.reply(`"${text}" so'ziga qanday javob qaytarilsin? Matnni kiriting:`);
  }

  if (user.state === 'awaiting_new_answer') {
    user.keywords.push({
      id: Date.now().toString(),
      keyword: user.tempKeyword,
      answer: text
    });
    user.state = null;
    delete user.tempKeyword;
    saveData(data);
    return ctx.reply('✅ Kalit so\'z muvaffaqiyatli saqlandi!');
  }

  // Admin holatlari
  if (isAdmin(ctx)) {
    if (user.state === 'admin_broadcast') {
      const users = Object.keys(data.users);
      let successCount = 0;
      for (const uid of users) {
        try {
          await bot.telegram.sendMessage(uid, text);
          successCount++;
        } catch (e) {}
      }
      user.state = null;
      saveData(data);
      return ctx.reply(`📢 Xabar ${successCount} ta foydalanuvchiga muvaffaqiyatli yuborildi.`);
    }

    if (user.state === 'admin_give_premium') {
      const targetId = text;
      if (data.users[targetId]) {
        const until = new Date();
        until.setDate(until.getDate() + PREMIUM_DAYS);
        data.users[targetId].isPremium = true;
        data.users[targetId].premiumUntil = until.toISOString();
        user.state = null;
        saveData(data);
        
        bot.telegram.sendMessage(targetId, `🎁 Admin tomonidan sizga ${PREMIUM_DAYS} kunlik Premium sovg'a qilindi!`).catch(console.error);
        return ctx.reply(`✅ ID: ${targetId} ga ${PREMIUM_DAYS} kunlik Premium berildi.`);
      } else {
        return ctx.reply('❌ Bunday ID ga ega foydalanuvchi topilmadi. Qaytadan urinib ko\'ring:');
      }
    }
  }
});

// --- Telegram Business ulanishlari va xabarlari -------------------------

// Foydalanuvchi o'z Business akkauntiga botni ulaganda/uzganda
bot.on('business_connection', (ctx) => {
  const conn = ctx.update.business_connection;
  const data = loadData();
  if (!data.businessConnections) data.businessConnections = {};
  
  if (conn.is_enabled) {
    data.businessConnections[conn.id] = String(conn.user.id);
    console.log(`🔗 Ulanish saqlandi: ${conn.id} -> ${conn.user.id}`);
  } else {
    delete data.businessConnections[conn.id];
    console.log(`❌ Ulanish uzildi: ${conn.id}`);
  }
  saveData(data);
});

// Mijozlar Business akkauntga yozganda ishga tushadigan qism
bot.on('business_message', async (ctx) => {
  const bm = ctx.update.business_message;
  if (!bm || !bm.text) return;
  
  const data = loadData();
  // Xabar qaysi foydalanuvchiga (qaysi business akkauntga) kelganini topamiz
  const ownerId = data.businessConnections?.[bm.business_connection_id];
  if (!ownerId) return;

  const owner = data.users[ownerId];
  if (!owner) return;

  const textLower = bm.text.toLowerCase();
  
  // Egasining kalit so'zlaridan mosini qidirish
  const match = owner.keywords.find(k => textLower.includes(k.keyword.toLowerCase()));
  
  if (match) {
    if (!data.stats) data.stats = { autoRepliedMessages: 0 };
    data.stats.autoRepliedMessages += 1;
    saveData(data);

    try {
      await ctx.telegram.sendMessage(bm.chat.id, match.answer, {
        business_connection_id: bm.business_connection_id
      });
    } catch (err) {
      console.error("Business xabar yuborishda xatolik:", err);
    }
  }
});

// --- Xatoliklarni ushlash va ishga tushirish ----------------------------

bot.catch((err, ctx) => {
  console.error(`Xatolik (${ctx.updateType}):`, err);
});

bot.launch({
  allowedUpdates: [
    'message',
    'callback_query',
    'business_connection',
    'business_message'
  ]
}).then(() => {
  console.log('✅ Avto Chat Bot (Multi-user) ishga tushdi!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
