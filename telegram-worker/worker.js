const corsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

const ALLOWED_ORIGIN = "https://wepoftus-star.github.io";

function response(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, "Access-Control-Allow-Origin": origin || ALLOWED_ORIGIN}
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) return response({ok:false, error:"Origin not allowed"}, 403, ALLOWED_ORIGIN);
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:{...corsHeaders, "Access-Control-Allow-Origin":origin}});
    if (request.method !== "POST") return response({ok:false, error:"Method not allowed"}, 405, origin);

    let order;
    try { order = await request.json(); } catch { return response({ok:false, error:"Invalid JSON"}, 400, origin); }
    const clean = value => typeof value === "string" ? value.trim().slice(0, 2000) : "";
    const name = clean(order.name);
    const contact = clean(order.contact);
    const email = clean(order.email);
    const comment = clean(order.comment);
    const items = Array.isArray(order.items) ? order.items.slice(0, 20) : [];
    if (!name || !contact || !order.consent || !items.length) {
      return response({ok:false, error:"Заполните обязательные поля и выберите товар."}, 400, origin);
    }

    const lines = items.map(item => {
      const productName = clean(item.name).slice(0, 160);
      const quantity = Math.max(1, Math.min(99, Number.parseInt(item.quantity, 10) || 1));
      return `• ${productName} — ${quantity} шт.`;
    });
    const message = [
      "🛍 НОВАЯ ЗАЯВКА С САЙТА",
      "",
      `👤 Имя: ${name}`,
      `📞 Контакт: ${contact}`,
      email ? `✉️ Email: ${email}` : "",
      "",
      "📦 Изделия:",
      ...lines,
      "",
      comment ? `💬 Комментарий:\n${comment}` : "💬 Комментарий: не указан",
      "",
      `🕒 Время: ${new Date().toISOString()}`
    ].filter(Boolean).join("\n");

    const telegramResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({chat_id: env.TELEGRAM_CHAT_ID, text: message})
    });
    const telegramResult = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || !telegramResult.ok) {
      return response({ok:false, error:"Telegram не принял сообщение. Проверьте настройки бота."}, 502, origin);
    }
    return response({ok:true}, 200, origin);
  }
};
