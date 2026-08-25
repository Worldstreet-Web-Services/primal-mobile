import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CopyMark, useCopy } from "../components/CopyAction";
import { QrPlate } from "../components/QrPlate";
import {
  Body,
  Display,
  GhostButton,
  Label,
  Mono,
  PressableScale,
  Pulse,
} from "../components/ui";
import { useLinkpayAccount, type AccountPhase } from "../hooks/useLinkpay";
import {
  accountStatusLabel,
  type LinkpayAccount,
} from "../lib/gateway/linkpay";
import { C, F } from "../theme/tokens";

/** Only gateway-returned account data may become copyable or scannable. */
function bankBlockFor(account: LinkpayAccount | null): string | null {
  const number = account?.accountNumber?.replace(/\s/g, "");
  if (!number) return null;
  return [account?.accountName, account?.bankName, number]
    .filter((line): line is string => !!line)
    .join("\n");
}

function bankNotice(
  phase: AccountPhase,
  account: LinkpayAccount | null,
  error: string | null,
): string {
  switch (phase) {
    case "signed_out":
      return "Sign in to see your naira account number.";
    case "unentitled":
      return "A Primal subscription is required before LinkPay can return your account.";
    case "activating":
      return "Your payment is being enabled. The account appears after entitlement propagation finishes.";
    case "no_account":
      return "Open your LinkPay account and its permanent naira account number will appear here.";
    case "provisioning":
      return "The bank is still opening your account. This page checks again while you wait.";
    case "provision_failed":
      return (
        account?.failureReason ??
        "The account could not be opened. Review your details before retrying."
      );
    case "disabled":
      return "This account is disabled, so its number is hidden to prevent a returned transfer.";
    case "unknown_status":
      return `Account status: ${accountStatusLabel(account?.status ?? "UNKNOWN")}. Primal will not expose an account it cannot verify as usable.`;
    case "error":
      return error ?? "Could not load your account details.";
    default:
      return "No account number is available yet.";
  }
}

function actionForPhase(
  phase: AccountPhase,
  actions: {
    onProvision?: () => void;
    onNeedsSubscription?: () => void;
    onNeedsSignIn?: () => void;
  },
): { label: string; onPress?: () => void } | null {
  if (phase === "no_account" || phase === "provision_failed") {
    return { label: "Open or review account", onPress: actions.onProvision };
  }
  if (phase === "unentitled") {
    return { label: "See membership", onPress: actions.onNeedsSubscription };
  }
  if (phase === "signed_out") {
    return { label: "Sign in", onPress: actions.onNeedsSignIn };
  }
  return null;
}

/**
 * Gateway-supported receive sheet.
 *
 * LinkPay deposits are provider-detected bank transfers. The frontend does not
 * create a deposit or claim that one landed; it only exposes the active account
 * returned by `/v1/linkpay/account`. General crypto deposit addresses are not
 * part of the public Gateway v0.1 contract and deliberately do not appear here.
 */
export default function ReceiveSheet({
  onClose,
  onProvision,
  onNeedsSubscription,
  onNeedsSignIn,
}: {
  onClose?: () => void;
  onProvision?: () => void;
  onNeedsSubscription?: () => void;
  onNeedsSignIn?: () => void;
}) {
  const { copied, copy } = useCopy();
  const { phase, account, error } = useLinkpayAccount();
  const insets = useSafeAreaInsets();

  const bankShare = phase === "ready" ? bankBlockFor(account) : null;
  const accountNumber = account?.accountNumber ?? "";
  const provenance = [account?.bankName, account?.accountName].filter(
    (part): part is string => !!part,
  );
  const action = actionForPhase(phase, {
    onProvision,
    onNeedsSubscription,
    onNeedsSignIn,
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, justifyContent: "flex-end" }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss" />
      <View
        style={{
          backgroundColor: C.sheet,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: C.border,
          paddingTop: 12,
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 26,
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 3,
            backgroundColor: C.borderStrong,
            alignSelf: "center",
            marginBottom: 16,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Display size={21}>Receive naira</Display>
            <Body size={11.5} color={C.dim} style={{ marginTop: 3 }}>
              Bank transfers credit your LinkPay fiat balance.
            </Body>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 16,
              backgroundColor: C.inset,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: C.sub, fontSize: 14 }}>✕</Text>
          </Pressable>
        </View>

        {bankShare ? (
          <View>
            <View style={{ marginTop: 20 }}>
              <QrPlate
                value={bankShare}
                size={132}
                caption={account?.bankName ?? "Naira account"}
              />
            </View>
            <PressableScale
              onPress={() => void copy("va", accountNumber.replace(/\s/g, ""))}
              scale={0.985}
            >
              <View
                accessibilityRole="button"
                accessibilityLabel="Copy account number"
                style={{
                  marginTop: 18,
                  alignItems: "center",
                  backgroundColor: C.raised,
                  borderWidth: 1,
                  borderColor: copied === "va" ? "rgba(240,199,90,0.4)" : C.border,
                  borderRadius: 20,
                  paddingVertical: 16,
                }}
              >
                <Label>Account number</Label>
                <Mono
                  size={25}
                  color={C.text}
                  style={{ fontFamily: F.monoSemibold, letterSpacing: 3, marginTop: 8 }}
                >
                  {accountNumber}
                </Mono>
                {provenance.length ? (
                  <Body size={12} color={C.sub} style={{ marginTop: 8 }}>
                    {provenance.join(" · ")}
                  </Body>
                ) : null}
                <View style={{ marginTop: 12 }}>
                  <CopyMark copied={copied === "va"} label="TAP TO COPY" />
                </View>
              </View>
            </PressableScale>
            {provenance.length ? (
              <View style={{ marginTop: 14 }}>
                <GhostButton
                  label={copied === "block" ? "Copied" : "Copy name, bank and number"}
                  height={48}
                  onPress={() => void copy("block", bankShare)}
                />
              </View>
            ) : null}
            <Body
              size={11}
              color={C.dim}
              style={{ textAlign: "center", marginTop: 14, lineHeight: 17.5 }}
            >
              Transfers are credited only after LinkPay reports the provider deposit.
            </Body>
          </View>
        ) : phase === "loading" ? (
          <View style={{ marginTop: 20, alignItems: "center", gap: 14 }}>
            <Pulse width={132} height={132} radius={22} />
            <Pulse height={78} radius={20} />
            <Pulse width="60%" height={12} />
          </View>
        ) : (
          <View style={{ marginTop: 24, paddingBottom: 6 }}>
            <Body
              size={12.5}
              color={C.dim}
              style={{ textAlign: "center", maxWidth: 310, alignSelf: "center", lineHeight: 19 }}
            >
              {bankNotice(phase, account, error)}
            </Body>
            {action?.onPress ? (
              <View style={{ marginTop: 16 }}>
                <GhostButton label={action.label} height={48} onPress={action.onPress} />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}
