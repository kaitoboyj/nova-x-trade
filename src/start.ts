import "./lib/buffer-polyfill";
import { createStart, createMiddleware } from "@tanstack/react-start";


import { renderBlockedPage, renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Operator-controlled IP blocking. Runs on every request so a blocked address
 * cannot load any page of the site. A lookup failure never takes the site down.
 */
const ipBlockMiddleware = createMiddleware().server(async ({ request, next }) => {
  try {
    const { clientIpFromRequest } = await import("./lib/ip-notice");
    const ip = clientIpFromRequest(request);
    if (ip) {
      const { isRequestIpBlocked } = await import("./lib/ip-notice.server");
      if (await isRequestIpBlocked(ip)) {
        return new Response(renderBlockedPage(), {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    }
  } catch {
    /* never block traffic because the list could not be read */
  }
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, ipBlockMiddleware],
}));
