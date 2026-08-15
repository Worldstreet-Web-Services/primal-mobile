// REST client for the King of Night vault gateway (v4 — multi-game: many
// concurrent games, each with its own gameId, pot, countdown and king).
// React Native has no CORS, so we call the gateway directly. The gateway
// rate-limits ~100 req/min per IP, so polling is the fallback, not the
// default (the WebSocket is the primary feed; see src/store/vault.ts).
//
// Reads are indexed from chain logs and are eventually consistent — they
// trail the chain by confirmation depth, so a brand-new game can take a few
// blocks to appear here. For instant confirmation of the user's OWN action,
// read the contract directly (src/lib/vault/wager.ts) and overlay.

export const VAULT_API_URL = process.env.EXPO_PUBLIC_VAULT_API_URL ?? "";
export const VAULT_WS_URL = process.env.EXPO_PUBLIC_VAULT_WS_URL ?? "";
export const VAULT_CONTRACT_ADDRESS =
  process.env.EXPO_PUBLIC_VAULT_CONTRACT_ADDRESS ?? "";

export interface Money {
  /** Decimal token string in human units (e.g. "0.002"), NOT wei. */
  amount: string;
  tokenSymbol: string;
  usdValue: number;
  formattedUsd: string;
}

export interface VaultGame {
  gameId: number;
  /** Paid the opening stake; earns 10% of the pot at settlement. */
  starter: string;
  /** The would-be winner: the last wagerer. */
  king: string;
  pot: Money;
  /** The starter's stake — every joiner must wager at least this. */
  minWager: Money;
  /** Unix SECONDS when the round ends. */
  endTime: number;
  /** Seconds, as computed by the gateway at response time. */
  timeRemaining: number;
  settled: boolean;
  active: boolean;
}

export interface VaultWinner {
  gameId: number;
  winner: string;
  starter: string;
  pot: Money;
  /** The winner's 50% cut (50/40/10 winner/treasury/starter). */
  toWinner: Money;
  settlementTx: string;
  settledAt: string; // ISO
}

export type VaultActivityAction = "started" | "joined" | "won";

export interface VaultActivity {
  id: string;
  action: VaultActivityAction;
  address: string;
  /** Raw wei string — event payloads are wei, unlike Money.amount. */
  amountWei: string;
  transactionHash: string;
  createdAt: string; // ISO
}

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${VAULT_API_URL}/${path}`, {
      signal: controller.signal,
    });
    const body = (await res.json()) as Envelope<T>;
    if (!body.success) {
      throw new Error(body.error?.message ?? `Vault API error on ${path}`);
    }
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

/** The lobby: every game, newest first. */
export const fetchVaultGames = () =>
  get<{ games: VaultGame[] }>("games").then((d) => d.games ?? []);
export const fetchVaultGame = (gameId: number) =>
  get<{ game: VaultGame }>(`games/${gameId}`).then((d) => d.game);
export const fetchVaultWinners = () =>
  get<{ winners: VaultWinner[] }>("game/winners").then((d) => d.winners ?? []);
export const fetchVaultActivities = () =>
  get<{ activities: VaultActivity[] }>("game/activities").then(
    (d) => d.activities ?? [],
  );
