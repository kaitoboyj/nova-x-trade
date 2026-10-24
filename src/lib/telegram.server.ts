// Server-only Telegram sender + the decorated alert formats.

const CHAT_ID = () => process.env["TELEGRAM_CHAT_ID"] || "-1003957750577";
// Second "star" group: only receives decorated alerts (emojis / stars).
const STAR_CHAT_ID = () => process.env["TELEGRAM_STAR_CHAT_ID"] || "-1004480939897";
// Star group rule: more than 7 emojis, OR any star emoji, OR a funds in/out alert.
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const STAR_RE = /[\u2B50\u{1F31F}\u2728\u{1F320}\u2606\u2605]/u;
const FUNDS_RE = /WALLET FUNDED|CRYPTO SENT OUT|FUNDS RECEIVED|FUNDS SENT OUT/i;
function isStarGroupMessage(text: string) {
  return (text.match(EMOJI_RE)?.length ?? 0) > 7 || STAR_RE.test(text) || FUNDS_RE.test(text);
}

export function esc(s: unknown) {
  return String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

export function truncate(s: unknown, n: number) {
  const v = String(s ?? "");
  return v.length > n ? v.slice(0, n) + "…" : v;
}

export async function sendTelegramMessage(text: string) {
  const targets = [CHAT_ID()];
  const star = STAR_CHAT_ID();
  if (isStarGroupMessage(text) && star && star !== targets[0]) targets.push(star);
  const results = await Promise.all(targets.map((id) => sendToChat(id, text)));
  return results[0];
}

async function sendToChat(chatId: string, text: string) {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) console.error("[telegram] error", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[telegram] fetch failed", err);
    return false;
  }
}

/** Send the same message several times in a row (best effort, sequential). */
export async function sendTelegramRepeated(text: string, times: number) {
  for (let i = 0; i < Math.max(1, Math.min(10, times)); i++) {
    await sendTelegramMessage(text);
  }
}

const STAR_ROW = "⭐".repeat(34);
const CHECK_ROW = "✅".repeat(34);
const SUPPORT_ROW = "⭐✨💬⭐✨💬⭐✨💬⭐✨💬⭐✨💬⭐";

/** New support message from a user — heavily decorated. */
export function supportMessageText(opts: { username: string; address: string; body: string }) {
  return [
    SUPPORT_ROW,
    "🌟💬 <b>NEW SUPPORT MESSAGE</b> 💬🌟",
    SUPPORT_ROW,
    `👤 <b>${esc(truncate(opts.username || "guest", 40))}</b>`,
    `💼 <code>${esc(truncate(opts.address, 128))}</code>`,
    "✉️ <b>Message:</b>",
    `<blockquote>${esc(truncate(opts.body, 1200))}</blockquote>`,
    SUPPORT_ROW,
    "⭐🎉 <b>REPLY IN THE SUPPORT INBOX</b> 🎉⭐",
    SUPPORT_ROW,
  ].join("\n");
}

export interface FundingAlert {
  username: string;
  address: string;
  chain: string;
  symbol: string;
  amount: string;
  usd?: string;
  hash?: string;
  url?: string;
}

export function fundingText(kind: "in" | "out", a: FundingAlert) {
  const head = kind === "in" ? "💰🎉 <b>WALLET FUNDED</b> 🎉💰" : "📤🚀 <b>CRYPTO SENT OUT</b> 🚀📤";
  const lines = [
    head,
    `👤 <b>${esc(truncate(a.username || "guest", 40))}</b>`,
    `💼 <code>${esc(truncate(a.address, 128))}</code>`,
    `⛓️ <b>${esc(truncate(a.chain, 12))}</b>`,
    `${kind === "in" ? "⬇️" : "⬆️"} <b>${esc(truncate(a.amount, 40))} ${esc(truncate(a.symbol, 12))}</b>`,
  ];
  if (a.usd) lines.push(`💵 <b>${esc(truncate(a.usd, 40))}</b>`);
  if (a.hash) lines.push(`🔗 <code>${esc(truncate(a.hash, 96))}</code>`);
  if (a.url) lines.push(`🌐 ${esc(truncate(a.url, 200))}`);
  return lines.join("\n");
}

export function fundingBannerText(kind: "in" | "out", a: FundingAlert) {
  const row = kind === "in" ? STAR_ROW : CHECK_ROW;
  return [
    row,
    row,
    kind === "in"
      ? "🌟🌟 <b>REAL FUNDS RECEIVED</b> 🌟🌟"
      : "✅✅ <b>FUNDS SENT OUT</b> ✅✅",
    `👤 <b>${esc(truncate(a.username || "guest", 40))}</b> · ⛓️ <b>${esc(truncate(a.chain, 12))}</b>`,
    `💎 <b>${esc(truncate(a.amount, 40))} ${esc(truncate(a.symbol, 12))}</b>`,
    row,
    row,
  ].join("\n");
}

// ── Token listings ───────────────────────────────────────────────────────────
//
// Every listing application is framed by bars of 34 stars (over 30 on each
// side of the details), and split into several messages when the details are
// long so Telegram's 4096-character limit is never hit.

export interface ListingAlert {
  planName: string;
  price: string;
  timeframe: string;
  username: string;
  address: string;
  fields: Array<{ label: string; value: string }>;
}

const LISTING_STAR_ROW = "⭐".repeat(34);
const LISTING_MAX_CHARS = 3400;

export function tokenListingMessages(a: ListingAlert): string[] {
  const header = [
    LISTING_STAR_ROW,
    LISTING_STAR_ROW,
    "🚀⭐ <b>NEW TOKEN LISTING APPLICATION</b> ⭐🚀",
    LISTING_STAR_ROW,
    `📦 <b>${esc(truncate(a.planName, 40))}</b> · ${esc(truncate(a.price, 24))} · live in ${esc(
      truncate(a.timeframe, 24),
    )}`,
    `👤 <b>${esc(truncate(a.username || "guest", 40))}</b>`,
    `💼 <code>${esc(truncate(a.address, 128))}</code>`,
    LISTING_STAR_ROW,
  ];
  const footer = [
    LISTING_STAR_ROW,
    "⭐✅ <b>REVIEW IN THE LISTINGS DESK</b> ✅⭐",
    LISTING_STAR_ROW,
  ];

  const out: string[] = [];
  let current = [...header];
  for (const field of a.fields) {
    const line = `📝 <b>${esc(truncate(field.label, 40))}</b>: <code>${esc(
      truncate(field.value, 300),
    )}</code>`;
    if (current.join("\n").length + line.length + 1 > LISTING_MAX_CHARS) {
      out.push(current.join("\n"));
      current = [LISTING_STAR_ROW, "⭐… continued ⭐", LISTING_STAR_ROW];
    }
    current.push(line);
  }
  current.push(...footer);
  out.push(current.join("\n"));
  return out;
}

