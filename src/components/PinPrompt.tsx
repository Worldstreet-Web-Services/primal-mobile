import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Display, Keypad, PinDots } from "@/components/ui";
import { setPinPrompt } from "@/lib/auth/decane";
import * as storage from "@/lib/auth/storage";
import { C } from "@/theme/tokens";

/**
 * The PIN sheet the Decane SDK opens when it reaches the PIN unlock tier.
 *
 * That tier is the last resort — it is only reached when the device has
 * neither a usable passkey (no `rpId`, or no PRF support) nor a Secure Enclave.
 * Simulators have no Secure Enclave at all, so it is the *default* path there,
 * which is how an unwired prompt showed up as a sign-in failure.
 *
 * The SDK calls `promptPin()` and awaits a string, so this bridges a callback
 * into UI: the handler stores the promise's resolver, the modal collects the
 * digits, and entry resolves it.
 *
 * One PIN, two jobs: the same 4 digits unwrap the wallet's device share here
 * and gate money-out later, so a user is never asked to invent two.
 */

interface PinPromptApi {
  /** Ask for the PIN outside the SDK flow — e.g. re-unlocking before a signature. */
  request: (reason?: string) => Promise<string>;
}

const PinPromptContext = createContext<PinPromptApi | null>(null);

export function usePinPrompt(): PinPromptApi {
  const ctx = useContext(PinPromptContext);
  if (!ctx) throw new Error("usePinPrompt must be used inside <PinPromptProvider>");
  return ctx;
}

type Phase = "enter" | "confirm";

export function PinPromptProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [phase, setPhase] = useState<Phase>("enter");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Held across renders because the SDK's await sits on the other end of it.
  const resolver = useRef<{
    resolve: (pin: string) => void;
    reject: (reason: Error) => void;
  } | null>(null);

  const close = useCallback(() => {
    setVisible(false);
    setPin("");
    setFirst("");
    setError(null);
  }, []);

  const request = useCallback(async () => {
    // No stored PIN means this is the first time the tier has been reached, so
    // the sheet has to create one (twice, to catch a typo) rather than check it.
    const hasPin = await storage.hasPin();

    return new Promise<string>((resolve, reject) => {
      resolver.current = { resolve, reject };
      setCreating(!hasPin);
      setPhase("enter");
      setPin("");
      setFirst("");
      setError(null);
      setVisible(true);
    });
  }, []);

  // Hand the prompt to the SDK once, for the lifetime of the provider.
  React.useEffect(() => {
    setPinPrompt(() => request());
    return () => setPinPrompt(null);
  }, [request]);

  const finish = useCallback(
    (value: string) => {
      const r = resolver.current;
      resolver.current = null;
      close();
      r?.resolve(value);
    },
    [close],
  );

  const onKey = (k: string) => {
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;

    const next = pin + k;
    setPin(next);
    if (next.length < 4) return;

    // Let the fourth dot paint before the sheet reacts.
    setTimeout(async () => {
      if (creating) {
        if (phase === "enter") {
          setFirst(next);
          setPin("");
          setPhase("confirm");
          return;
        }
        if (next !== first) {
          setError("Those didn't match. Start again.");
          setFirst("");
          setPin("");
          setPhase("enter");
          return;
        }
        // Persist so the transaction PIN and the wallet PIN stay the same.
        await storage.savePin(next);
        finish(next);
        return;
      }

      if (await storage.verifyPin(next)) {
        finish(next);
        return;
      }
      setError("Wrong PIN.");
      setPin("");
    }, 180);
  };

  const value = useMemo<PinPromptApi>(() => ({ request }), [request]);

  const title = creating
    ? phase === "confirm"
      ? "Confirm your PIN"
      : "Create a PIN"
    : "Enter your PIN";

  const subtitle = creating
    ? "It unlocks your wallet and approves money leaving Paradigm."
    : "Unlock your wallet to continue.";

  return (
    <PinPromptContext.Provider value={value}>
      {children}

      {/* Not dismissible: the SDK is awaiting a value, and a stray back-swipe
          would leave that promise hanging forever. */}
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View
          style={{
            flex: 1,
            backgroundColor: C.canvas,
            paddingHorizontal: 24,
            paddingTop: insets.top + 24,
            paddingBottom: Math.max(insets.bottom, 16) + 18,
          }}
        >
          <Display size={26}>{title}</Display>
          <Body
            size={13.5}
            color={C.sub}
            style={{ marginTop: 10, lineHeight: 21 }}
          >
            {subtitle}
          </Body>

          <View style={{ marginTop: 40 }}>
            <PinDots filled={pin.length} />
          </View>

          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            {error ? (
              <Body size={12.5} color={C.down}>
                {error}
              </Body>
            ) : null}
          </View>

          <Keypad onKey={onKey} />
        </View>
      </Modal>
    </PinPromptContext.Provider>
  );
}
