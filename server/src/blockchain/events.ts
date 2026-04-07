import { getRegistry, getHook } from "./contracts.js";

export function listenForProposalEvents(
  onStartupRegistered?: (jobId: bigint, owner: string, name: string) => void,
  onFunded?: (jobId: bigint, investor: string, amount: bigint) => void,
  onCompleted?: (jobId: bigint) => void,
  onFailed?: (jobId: bigint) => void,
): void {
  const registry = getRegistry();
  if (!registry) return;

  if (onStartupRegistered) {
    registry.on("StartupRegistered", (jobId, owner, name) => {
      onStartupRegistered(jobId, owner, name);
    });
  }

  if (onFunded) {
    registry.on("JobFunded", (jobId, investor, amount) => {
      onFunded(jobId, investor, amount);
    });
  }

  if (onCompleted) {
    registry.on("JobCompleted", (jobId) => {
      onCompleted(jobId);
    });
  }

  if (onFailed) {
    registry.on("JobFailed", (jobId) => {
      onFailed(jobId);
    });
  }
}

export function listenForHookEvents(
  onFeesDistributed?: (jobId: bigint, amount: bigint) => void,
  onBuyback?: (jobId: bigint, usdxSpent: bigint, tokensBought: bigint) => void,
): void {
  const h = getHook();
  if (!h) return;

  if (onFeesDistributed) {
    h.on("FeesDistributed", (jobId, amount) => {
      onFeesDistributed(jobId, amount);
    });
  }

  if (onBuyback) {
    h.on("BuybackExecuted", (jobId, usdxSpent, tokensBought) => {
      onBuyback(jobId, usdxSpent, tokensBought);
    });
  }
}

export function stopListening(): void {
  const registry = getRegistry();
  if (registry) registry.removeAllListeners();

  const h = getHook();
  if (h) h.removeAllListeners();
}
