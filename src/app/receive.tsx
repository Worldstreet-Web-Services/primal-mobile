import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import {
  type AccountSummary,
  getMe,
  provisionAccount,
  usingMockApi,
} from "@/lib/api";

/**
 * Receive screen (PRD F2): the user's own account number — a real bank
 * account anyone can transfer to. Provisioning is explicit and retryable:
 * `/me` never blocks on the provider, so this screen owns the one request
 * that does.
 */
export default function Receive() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMe()
      .then((me) => setAccount(me.account))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const provision = useCallback(() => {
    setProvisioning(true);
    setError(null);
    provisionAccount()
      .then(setAccount)
      .catch((e: Error) => setError(e.message))
      .finally(() => setProvisioning(false));
  }, []);

  const copy = useCallback(async () => {
    if (!account?.accountNumber) return;
    await Clipboard.setStringAsync(account.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [account?.accountNumber]);

  return (
    <View className="flex-1 bg-canvas px-5 pt-4">
      <Text className="text-2xl font-semibold text-silver">Receive money</Text>
      <Text className="mt-1 text-silver-muted">
        Share your account number — transfers land as Primal balance.
      </Text>

      {loading ? (
        <View className="mt-16 items-center">
          <ActivityIndicator color="#B4FF39" />
        </View>
      ) : account?.provisioned ? (
        <View className="mt-8 rounded-2xl bg-canvas-raised p-5">
          <Text className="text-xs uppercase tracking-widest text-silver-muted">
            {account.bankName ?? "Your bank"}
          </Text>
          <Text className="mt-2 text-4xl font-bold tracking-wider text-silver">
            {account.accountNumber}
          </Text>

          <Pressable
            onPress={copy}
            className="mt-5 items-center rounded-xl bg-lime py-3 active:opacity-80"
          >
            <Text className="font-semibold text-lime-ink">
              {copied ? "Copied" : "Copy account number"}
            </Text>
          </Pressable>

          {/* QR lands with the design pass (PRD §5, screen 3). */}
          <View className="mt-5 h-40 items-center justify-center rounded-xl bg-canvas-inset">
            <Text className="text-silver-faint">QR code</Text>
          </View>
        </View>
      ) : (
        <View className="mt-8 rounded-2xl bg-canvas-raised p-5">
          <Text className="text-silver">
            Get your personal account number. It takes a few seconds.
          </Text>
          <Pressable
            onPress={provision}
            disabled={provisioning}
            className="mt-5 items-center rounded-xl bg-lime py-3 active:opacity-80 disabled:opacity-50"
          >
            {provisioning ? (
              <ActivityIndicator color="#101400" />
            ) : (
              <Text className="font-semibold text-lime-ink">
                Create my account number
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {error ? (
        <View className="mt-4 rounded-xl bg-canvas-raised p-4">
          <Text className="text-red-400">{error}</Text>
          <Text className="mt-1 text-silver-muted">
            Nothing was created twice — retrying is safe.
          </Text>
        </View>
      ) : null}

      {usingMockApi ? (
        <Text className="mt-6 text-center text-xs text-silver-faint">
          Preview data — set EXPO_PUBLIC_API_URL to use the live backend.
        </Text>
      ) : null}
    </View>
  );
}
