import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  LISTING_FIELDS,
  listingPlanById,
  listingRowAddress,
  parseTokenListing,
  tokenListingToNote,
  validateListingValues,
  type ListingPlanId,
  type TokenListingApplication,
} from "./token-listing";

function normWallet(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

/** An uploaded logo arrives as a data URL; never echo the whole payload. */
function telegramValue(value: string) {
  return value.startsWith("data:") ? "uploaded image file" : value;
}

/** The signed-in wallet's own application, used to show it under review. */
export const getMyTokenListing = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({
    wallet_address: normWallet(d?.wallet_address),
  }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("note")
      .eq("wallet_address", listingRowAddress(data.wallet_address))
      .maybeSingle();
    if (error) return { listing: null as TokenListingApplication | null, available: false };
    return { listing: parseTokenListing(row?.note), available: true };
  });

/**
 * Saves the application to the reserved listing row and sends the whole thing
 * to Telegram. The details are validated again here so the notification can
 * never carry an application the form would have rejected.
 */
export const submitTokenListing = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      plan: ListingPlanId;
      username?: string;
      fields: Record<string, string>;
    }) => {
      const parsed = z
        .object({
          wallet_address: z.string(),
          plan: z.enum(["basic", "fast"]),
          username: z.string().optional(),
          fields: z.record(z.string(), z.string()),
        })
        .strict()
        .parse(d);
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed.fields)) {
        fields[String(key).slice(0, 40)] = String(value ?? "").slice(0, 700_000);
      }
      return {
        wallet_address: normWallet(parsed.wallet_address),
        plan: parsed.plan as ListingPlanId,
        username: String(parsed.username ?? "").slice(0, 40),
        fields,
      };
    },
  )
  .handler(async ({ data }) => {
    const problems = validateListingValues(data.fields);
    if (Object.keys(problems).length) {
      throw new Error("Some token details are invalid. Check the highlighted fields.");
    }

    const plan = listingPlanById(data.plan);
    const application: TokenListingApplication = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      plan: plan.id,
      status: "review",
      submittedAt: Date.now(),
      fields: data.fields,
    };

    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        {
          wallet_address: listingRowAddress(data.wallet_address),
          note: tokenListingToNote(application),
        },
        { onConflict: "wallet_address" },
      );
    if (error) throw new Error("The listing application could not be saved. Please try again.");

    try {
      const { sendTelegramMessage, tokenListingMessages } = await import("./telegram.server");
      const messages = tokenListingMessages({
        planName: plan.name,
        price: `$${plan.price.toLocaleString("en-US")}`,
        timeframe: plan.timeframe,
        username: data.username,
        address: data.wallet_address,
        fields: LISTING_FIELDS.filter((field) => (data.fields[field.key] ?? "").trim()).map(
          (field) => ({
            label: field.label,
            value: telegramValue(String(data.fields[field.key] ?? "").trim()),
          }),
        ),
      });
      for (const text of messages) await sendTelegramMessage(text);
    } catch {
      /* the notification is best effort — the application is already saved */
    }

    return { listing: application };
  });
