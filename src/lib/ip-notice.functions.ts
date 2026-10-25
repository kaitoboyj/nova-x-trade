import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import {
  consumeIpNotice,
  deleteIpEntry,
  readIpAccessRow,
  requestClientIp,
  saveIpEntry,
  setIpBlocked,
} from "./ip-notice.server";

/** Public read: counts this visit and returns the popup text for this IP, if any. */
export const getIpNotice = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  try {
    const ip = await requestClientIp();
    return { ...(await consumeIpNotice(ip)), available: true as const };
  } catch {
    return {
      ip: "",
      message: "",
      limit: 0,
      shown: 0,
      blocked: false,
      available: false as const,
    };
  }
});

async function requireOperator() {
  if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
    throw new Error("Unlock Admin or Mix Man to manage IP notifications.");
  }
}

/** Full IP list for the Admin / Mix Man page. */
export const listIpAccess = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  await requireOperator();
  const store = await readIpAccessRow();
  return { entries: store.entries };
});

const saveSchema = z
  .object({
    ip: z.string(),
    message: z.string().optional(),
    limit: z.number().optional(),
    blocked: z.boolean().optional(),
    resetCount: z.boolean().optional(),
  })
  .strict();

/** Add or update one IP: message, how many times it shows, and the block flag. */
export const saveIpAccess = createServerFn({ method: "POST" })
  .inputValidator((value) => saveSchema.parse(value))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const store = await saveIpEntry(data);
    return { entries: store.entries };
  });

export const deleteIpAccess = createServerFn({ method: "POST" })
  .inputValidator((value) => z.object({ ip: z.string() }).strict().parse(value))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const store = await deleteIpEntry(data.ip);
    return { entries: store.entries };
  });

export const blockIpAccess = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    z.object({ ip: z.string(), blocked: z.boolean() }).strict().parse(value),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const store = await setIpBlocked(data.ip, data.blocked);
    return { entries: store.entries };
  });
