import { describe, expect, it } from "vitest";
import { readExtraFees, writeExtraFees } from "./withdraw";

// The saved map goes through the database as JSON, so round-trip it the same way.
const reload = (tokens: Record<string, number>) =>
  JSON.parse(JSON.stringify(tokens)) as Record<string, number>;

describe("withdrawal fee breakdown", () => {
  it("keeps the network, unlocking and exchange fees after a reload", () => {
    const saved = writeExtraFees(
      { ETH: 1.5 },
      { networkPct: 12, unlockFee: 0.2, unlockUnit: "ETH", exchangeFee: 5, exchangeUnit: "PCT" },
    );
    const fees = readExtraFees(reload(saved));
    expect(fees.networkPct).toBe(12);
    expect(fees.unlock).toEqual({ value: 0.2, unit: "ETH" });
    expect(fees.exchange).toEqual({ value: 5, unit: "PCT" });
  });

  it("does not drop the account's other balances when fees are saved", () => {
    const saved = writeExtraFees({ ETH: 1.5, BTC: 0.1 }, { networkPct: 3 });
    expect(saved.ETH).toBe(1.5);
    expect(saved.BTC).toBe(0.1);
  });

  it("caps the network fee at 100%", () => {
    expect(readExtraFees(writeExtraFees({}, { networkPct: 250 })).networkPct).toBe(100);
  });
});
