import { getRegistry } from "./contracts.js";

export function listenForProposalEvents(
  onCreated?: (id: bigint, owner: string, track: number) => void,
  onFunded?: (id: bigint, investor: string, amount: bigint) => void,
): void {
  const registry = getRegistry();
  if (!registry) return;

  if (onCreated) {
    registry.on("ProposalCreated", (id, owner, track) => {
      onCreated(id, owner, track);
    });
  }

  if (onFunded) {
    registry.on("ProposalFunded", (id, investor, amount) => {
      onFunded(id, investor, amount);
    });
  }
}

export function stopListening(): void {
  const registry = getRegistry();
  if (!registry) return;
  registry.removeAllListeners();
}
