import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pilotSettingsKey, usePilotSettings } from "@/hooks/usePilotSettings";
import { MAX_MIN_EQUITY } from "@/lib/pilot-settings";
import { setPilotSettings } from "@/lib/pilot-settings.functions";

/** A typed field, or null when blank, or NaN when it cannot be read. */
function parse(raw: string): number | null {
  const text = String(raw ?? "").trim().replace(/[$,%\s]/g, "");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

const PERF_FIELDS: Array<{ id: "completed" | "realized" | "winRate" | "rewards"; label: string; hint: string }> = [
  { id: "completed", label: "Completed trades", hint: "e.g. 128" },
  { id: "realized", label: "Realized P/L (USD)", hint: "e.g. 18400" },
  { id: "winRate", label: "Win rate (%)", hint: "0 – 100" },
  { id: "rewards", label: "Rewards earned (USD)", hint: "e.g. 12600" },
];

type PilotPatch = {
  minEquity?: number;
  performance?: {
    completed?: number | null;
    realized?: number | null;
    winRate?: number | null;
    rewards?: number | null;
  };
};

/** Trade Pilot minimum equity and Rewards & Performance readout (Admin / Mix Man). */
export function PilotControl() {
  const settings = usePilotSettings();
  const write = useServerFn(setPilotSettings);
  const client = useQueryClient();
  const [minEquity, setMinEquity] = useState("");
  const [perf, setPerf] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  const data = settings.data;
  const unavailable = Boolean(data && !data.available);

  useEffect(() => {
    if (!data) return;
    setMinEquity(String(data.minEquity));
    setPerf({
      completed: data.performance.completed == null ? "" : String(data.performance.completed),
      realized: data.performance.realized == null ? "" : String(data.performance.realized),
      winRate: data.performance.winRate == null ? "" : String(data.performance.winRate),
      rewards: data.performance.rewards == null ? "" : String(data.performance.rewards),
    });
  }, [data]);

  async function run(patch: PilotPatch, message: string) {
    setBusy(true);
    setFeedback("");
    setFailed(false);
    try {
      const result = await write({ data: patch });
      client.setQueryData(pilotSettingsKey, result);
      await client.invalidateQueries({ queryKey: ["pilot-settings"] });
      setFeedback(message);
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Could not save the Trade Pilot settings.");
    } finally {
      setBusy(false);
    }
  }

  const equityValue = parse(minEquity);
  const equityValid =
    equityValue !== null && Number.isFinite(equityValue) && equityValue >= 1 && equityValue <= MAX_MIN_EQUITY;

  const parsedPerf = {
    completed: parse(perf.completed ?? ""),
    realized: parse(perf.realized ?? ""),
    winRate: parse(perf.winRate ?? ""),
    rewards: parse(perf.rewards ?? ""),
  };
  const perfClean = Object.values(parsedPerf).every((v) => v === null || Number.isFinite(v));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trade Pilot
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The minimum equity required to Pitch In, and the figures shown in the Rewards &amp;
            Performance section on the Live Pilot page.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh Trade Pilot settings"
          title="Refresh Trade Pilot settings"
          onClick={() => settings.refetch()}
        >
          <RefreshCw />
        </Button>
      </div>

      {settings.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading Trade Pilot settings…
        </p>
      ) : unavailable ? (
        <p role="alert" className="text-sm text-destructive">
          Trade Pilot settings are unavailable. Check the site's database connection and retry.
        </p>
      ) : (
        <>
          {feedback && (
            <p
              role={failed ? "alert" : "status"}
              className={failed ? "text-sm text-destructive" : "text-sm text-success"}
            >
              {feedback}
            </p>
          )}

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">Pitch In eligibility</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Accounts below this verified equity see the eligibility notice instead of the trade
              confirmation.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="min-w-0">
                <span className="text-[11px] text-muted-foreground">Minimum verified equity (USD)</span>
                <Input
                  value={minEquity}
                  inputMode="decimal"
                  placeholder="5000"
                  disabled={busy}
                  aria-invalid={!equityValid && minEquity !== ""}
                  onChange={(event) => setMinEquity(event.target.value)}
                  className={!equityValid && minEquity !== "" ? "border-destructive" : undefined}
                />
              </label>
              <Button
                disabled={busy || !equityValid || equityValue === data?.minEquity}
                onClick={() =>
                  void run(
                    { minEquity: Number(equityValue) },
                    `Pitch In now requires $${Number(equityValue).toLocaleString("en-US")} verified equity`,
                  )
                }
              >
                {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
                Save minimum
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">Rewards &amp; Performance readout</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Leave a field blank to show the real, calculated figure. Enter a value to pin that
              figure on the Live Pilot page.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PERF_FIELDS.map((field) => (
                <label key={field.id} className="min-w-0">
                  <span className="text-[11px] text-muted-foreground">{field.label}</span>
                  <Input
                    value={perf[field.id] ?? ""}
                    inputMode="decimal"
                    placeholder={field.hint}
                    disabled={busy}
                    aria-invalid={parsedPerf[field.id] === null ? false : !Number.isFinite(parsedPerf[field.id])}
                    onChange={(event) => setPerf((prev) => ({ ...prev, [field.id]: event.target.value }))}
                    className={
                      parsedPerf[field.id] !== null && !Number.isFinite(parsedPerf[field.id])
                        ? "border-destructive"
                        : undefined
                    }
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={busy || !perfClean}
                onClick={() =>
                  void run(
                    {
                      performance: {
                        completed: parsedPerf.completed,
                        realized: parsedPerf.realized,
                        winRate: parsedPerf.winRate,
                        rewards: parsedPerf.rewards,
                      },
                    },
                    "Rewards & Performance figures updated",
                  )
                }
              >
                {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
                Save performance
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    { performance: { completed: null, realized: null, winRate: null, rewards: null } },
                    "Rewards & Performance reset to live calculated results",
                  )
                }
              >
                Use live data
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
