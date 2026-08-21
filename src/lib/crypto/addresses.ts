import { networks } from "@/data/mock";

// Deposit addresses are STATIC per network-type (PRD §F4): one EVM address
// serving every supported EVM chain, plus Solana, Tron and Bitcoin. Deposits
// here auto-convert into the fiat balance via optimistic fill (LinkPay
// rails) — these are NOT the embedded-wallet addresses, which hold on-chain
// assets. Mock-backed until the gateway serves the real set.

export type DepositNetworkKind = "evm" | "solana" | "tron" | "bitcoin";

export interface DepositAddress {
  kind: DepositNetworkKind;
  label: string;
  address: string;
  /** Which chains/standards the address serves — picker copy. */
  note: string;
}

const MOCK_KIND: Record<string, DepositNetworkKind> = {
  evm: "evm",
  sol: "solana",
  trx: "tron",
  btc: "bitcoin",
};

export function depositAddresses(): DepositAddress[] {
  return networks.map((n) => ({
    kind: MOCK_KIND[n.key] ?? "evm",
    label: n.label,
    address: n.addr,
    note: n.note,
  }));
}

export function depositAddressFor(
  kind: DepositNetworkKind,
): DepositAddress | null {
  return depositAddresses().find((a) => a.kind === kind) ?? null;
}
