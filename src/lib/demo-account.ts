import { saveSession } from "./wallet-auth";

/**
 * The hidden demo account is a local-preview tool: it lets the signed-in
 * experience be reviewed on a development machine before code is pushed and
 * deployed. It is therefore only offered on local / private hosts, and never on
 * the public deployment.
 */
export function demoAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (import.meta.env.DEV) return true;
  } catch {
    /* ignore */
  }
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/** Sign in the demo account on this device. */
export function startDemoSession(address: string, username: string) {
  saveSession({
    address,
    username,
    wallet: {
      id: "demo-account",
      label: username,
      createdAt: Date.now(),
      addresses: [],
    },
  });
}
