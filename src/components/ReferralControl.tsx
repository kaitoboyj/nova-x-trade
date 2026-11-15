import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, RefreshCw, Share2, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getReferralSettings, setReferralSettings } from "@/lib/referral-settings.functions";
import type { ReferralMode } from "@/lib/referral";

const MODES: Array<{ id: ReferralMode; title: string; body: string; icon: typeof Users }> = [
  {
    id: "general",
    title: "General",
    body: "Every account gets its own unique referral code to share with friends.",
    icon: Users,
  },
  {
    id: "solo",
    title: "Solo",
    body: "One shared site-wide referral code is used by everyone instead of personal codes.",
    icon: UserCheck,
  },
];

export function ReferralControl() {
  const read = useServerFn(getReferralSettings);
  const write = useServerFn(setReferralSettings);
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["referral-settings"],
    queryFn: () => read(),
    refetchInterval: 30_000,
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const enabled = settings.data?.enabled ?? true;
  const mode = settings.data?.mode ?? "general";
  const unavailable = settings.data ? settings.data.available === false : false;

  async function save(data: { enabled?: boolean; mode?: ReferralMode }, message: string) {
    setBusy(true);
    setFeedback("");
    setFailed(false);
    try {
      const result = await write({ data });
      client.setQueryData(["referral-settings"], result);
      await client.invalidateQueries({ queryKey: ["referral-settings"] });
      setFeedback(message);
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Could not save referral settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Share2 className="h-5 w-5 text-primary" />
            Referral program
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Site-wide referral codes and yield bonuses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={enabled ? "text-xs text-success" : "text-xs text-muted-foreground"}>
            {enabled ? "Active" : "Deactivated"}
          </span>
          <Switch
            checked={enabled}
            disabled={busy || unavailable}
            aria-label="Referral program active"
            onCheckedChange={(next) =>
              save(
                { enabled: next },
                next ? "Referral program activated" : "Referral program deactivated",
              )
            }
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh referral settings"
            title="Refresh referral settings"
            onClick={() => settings.refetch()}
          >
            <RefreshCw />
          </Button>
        </div>
      </div>

      {settings.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading referral settings…
        </p>
      ) : (
        unavailable && (
          <p role="alert" className="text-sm text-destructive">
            Referral settings are unavailable. Check your site's database connection and retry.
          </p>
        )
      )}

      {feedback && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "text-sm text-destructive" : "text-sm text-success"}
        >
          {feedback}
        </p>
      )}

      <section>
        <h3 className="mb-3 font-display text-base font-semibold">Code mode</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((option) => {
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={busy || unavailable || !enabled}
                onClick={() => save({ mode: option.id }, `Referral mode set to ${option.title}`)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-primary/60 bg-primary/5"
                    : "border-border hover:border-primary/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-primary/15 text-primary" : "bg-white/5 text-muted-foreground",
                  )}
                >
                  <option.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {option.title}
                    {active && (
                      <span className="text-[10px] uppercase tracking-widest text-primary">
                        Active
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.body}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Each recruited friend adds +1% to the recruiter's daily yield, up to a maximum of +25%.
      </p>
    </div>
  );
}
