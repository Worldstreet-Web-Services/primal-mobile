import { useCallback, useState } from "react";

import { fetchPricesUsd } from "@/lib/crypto/prices";
import { PLAY_TARGET_USD, usdToWei } from "@/lib/vault/format";
import { vaultSigner } from "@/lib/vault/signer";
import {
  AmbiguousSend,
  awaitWagerReceipt,
  basePublicClient,
  claimCalldata,
  isBundlerUnavailable,
  joinCalldata,
  ReceiptPending,
  readGameStatus,
  readMinStartStake,
  sendDirectVaultCall,
  sendSponsoredVaultCall,
  SigningFailed,
  sponsorEndpoints,
  startGameCalldata,
} from "@/lib/vault/wager";

// Vault actions from the user's wallet, via the VaultSigner seam. All ride
// the same rails: sponsored (gasless) endpoints in preference order, then a
// self-paid fallback when no sponsor is reachable. join() wagers on an
// existing game at that game's exact minWager; startGame() opens a fresh
// game at the $50 product stake; claim() pulls pendingWithdrawals.
export function useVaultActions() {
  const [wagering, setWagering] = useState(false);
  const [starting, setStarting] = useState(false);
  /**
   * The last action was accepted by the bundler but its receipt never
   * arrived. Distinct from failure: the caller must NOT tell the user they
   * are out, because they are probably in.
   */
  const [receiptPending, setReceiptPending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (
      data: `0x${string}`,
      value: bigint,
      setBusy: (b: boolean) => void,
      onAccepted?: () => void,
    ): Promise<`0x${string}` | null> => {
      setBusy(true);
      setError(null);
      setReceiptPending(false);
      try {
        // The seam is the only wallet these rails know about. The stub
        // signer throws right here until auth lands, and its message is the
        // user-facing answer — no wallet, no play.
        const address = await vaultSigner.getAddress();

        // Kick the provider and auth-token fetches off now; they resolve
        // while the balance read below is on the wire.
        const providerPromise = vaultSigner.getProvider();
        const accessTokenPromise = vaultSigner.getAccessToken();

        // Sponsorship covers GAS, never the wagered value itself — that ETH
        // leaves this wallet. An underfunded wallet used to sail into
        // eth_estimateUserOperationGas, whose simulation of the value
        // transfer reverts with an "unknown reason" wall of hex. Check first
        // and say what's actually wrong. Read failures don't block the play;
        // the send path surfaces its own errors. (Ark auto-swaps USDC → ETH
        // here in the same atomic batch; that ride-along needs the wsws trade
        // stack, which Paradigm doesn't carry yet.)
        if (value > 0n) {
          try {
            const balance = await basePublicClient().getBalance({ address });
            if (balance < value) {
              setError("Not enough to cover the stake, add funds first.");
              return null;
            }
          } catch {
            // Balance unreadable (RPC hiccup) — proceed and let the send decide.
          }
        }

        const provider = await providerPromise;
        const accessToken = (await accessTokenPromise) ?? "";

        // Walk the sponsored endpoints in order (wsws proxy, then direct
        // Alchemy); an unreachable endpoint passes the baton. Only when no
        // sponsor works does the wallet pay its own gas.
        let hash: `0x${string}` | null = null;
        let lastSponsorError: unknown = null;
        for (const endpoint of sponsorEndpoints(accessToken)) {
          try {
            hash = await sendSponsoredVaultCall({
              address,
              provider,
              signAuthorization: vaultSigner.signAuthorization,
              endpoint,
              data,
              value,
              onAccepted: onAccepted ? () => onAccepted() : undefined,
            });
            break; // sponsored path waits for the userOp receipt
          } catch (sponsorError) {
            if (!isBundlerUnavailable(sponsorError)) throw sponsorError;
            lastSponsorError = sponsorError;
          }
        }
        if (!hash) {
          if (lastSponsorError) {
            hash = await sendDirectVaultCall({ address, provider, data, value });
            // A returned tx hash means the node took it — same optimistic
            // moment as bundler acceptance on the sponsored path.
            onAccepted?.();
            await awaitWagerReceipt(hash);
          } else {
            throw new Error("No sponsorship endpoint is configured.");
          }
        }
        return hash;
      } catch (e) {
        if (e instanceof ReceiptPending) {
          setReceiptPending(true);
          setError("Submitted, still confirming. Check back in a moment.");
          return null;
        }
        // MUST come before the message matching below. An AmbiguousSend
        // usually carries "Operation reached timeout: user-signer:sign",
        // which hits the /timed? ?out/i branch and produces "check your
        // connection and try again" — telling the player it failed and
        // inviting the one retry that can pay the stake twice. The operation
        // may already be live; the only safe instruction is to look before
        // acting.
        // Nothing was signed, so nothing left the wallet. Say so plainly and
        // let them retry — this is the one send failure that is certain.
        if (e instanceof SigningFailed) {
          setError("Signing didn't finish, so nothing was sent. Try again.");
          return null;
        }
        if (e instanceof AmbiguousSend) {
          setReceiptPending(true);
          setError(
            "We couldn't confirm whether that went through. Check your games before trying again, retrying could pay twice.",
          );
          return null;
        }
        // Match against the FULL message (viem buries "insufficient funds"
        // deep in its dump), but never display it: a viem error carries the
        // whole request body — calldata, signature, bundler URL with the API
        // key — and that wall of hex is what used to fill the screen. Show
        // the one-line shortMessage instead.
        const fullMessage = e instanceof Error ? e.message : String(e);
        const shortMessage =
          ((e as { shortMessage?: string })?.shortMessage ?? fullMessage)
            .split("\n")[0]
            .trim();
        // Copy names what the player must DO, never the chain or service that
        // failed — "talking to Base" tells someone playing a game nothing they
        // can act on, and reads as our plumbing leaking onto their screen.
        setError(
          /insufficient|exceeds the balance|fund/i.test(fullMessage)
            ? "Not enough to cover the stake, add funds first."
            : /HTTP request failed|RPC Request failed|Failed to fetch|fetch failed|Network request failed|timed? ?out/i.test(
                  fullMessage,
                )
              ? "Couldn't reach the network, check your connection and try again."
              : shortMessage || "Something went wrong. Try again.",
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** The signer gate, alone. Without a wallet the honest first answer is the
   * seam's own message — never a pricing or read error that implies the
   * network is at fault. */
  const requireSigner = useCallback(async (): Promise<boolean> => {
    try {
      await vaultSigner.getAddress();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);

  /**
   * Wager on an existing game — the sender becomes king and the timer
   * resets. The value is that game's own minWager, read straight from the
   * contract so the amount is exact even when the lobby is a beat stale.
   */
  const join = useCallback(
    async (gameId: number, opts?: { onAccepted?: () => void }) => {
      if (!(await requireSigner())) return null;
      let value: bigint;
      try {
        const s = await readGameStatus(gameId);
        if (!s.active) {
          setError("That round already ended, pick another game.");
          return null;
        }
        value = s.minWager;
      } catch {
        setError("Couldn't read the game, check your connection.");
        return null;
      }
      return run(joinCalldata(gameId), value, setWagering, opts?.onAccepted);
    },
    [run, requireSigner],
  );

  /**
   * Open a fresh game. The stake becomes the new game's minWager for every
   * joiner, so Paradigm floors it at the ETH worth of PLAY_TARGET_USD — a
   * Paradigm-started game is a $50 game. `usdPerEth` comes from the
   * gateway's Money quotes; without one we refuse rather than silently
   * start a sub-dollar game at the chain floor (minStartStake — that global
   * floor is Worldstreet's config, not ours).
   */
  const startGame = useCallback(
    async (usdPerEth: number, opts?: { onAccepted?: () => void }) => {
      if (!(await requireSigner())) return null;
      let value: bigint;
      try {
        const floor = await readMinStartStake();
        if (!(usdPerEth > 0)) {
          // No gateway quote yet — a fresh v4 lobby has no Money objects to
          // price from. Borrow the crypto stack's feed (live Alchemy over a
          // static snapshot) rather than refusing the first-ever game: the
          // chain floor still guards the low side, and an over-estimate only
          // starts a slightly richer game.
          usdPerEth = (await fetchPricesUsd(["ETH"])).prices.ETH ?? 0;
        }
        if (!(usdPerEth > 0)) {
          setError("Couldn't price the stake, try again in a moment.");
          return null;
        }
        const target = usdToWei(PLAY_TARGET_USD, usdPerEth);
        value = target > floor ? target : floor;
      } catch {
        setError("Couldn't read the vault, check your connection.");
        return null;
      }
      return run(startGameCalldata(), value, setStarting, opts?.onAccepted);
    },
    [run, requireSigner],
  );

  /** Pull pending winnings whose push-payment failed at settlement. */
  const claim = useCallback(async () => {
    return run(claimCalldata(), 0n, setClaiming);
  }, [run]);

  return {
    join,
    wagering,
    startGame,
    starting,
    claim,
    claiming,
    error,
    receiptPending,
    clearError: () => setError(null),
  };
}
