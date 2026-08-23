import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import CreatePinScreen from "@/screens/CreatePinScreen";
import { C } from "@/theme/tokens";

export default function Pin() {
  const { createPin } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const onDone = async (pin: string) => {
    setSaving(true);
    try {
      await createPin(pin);
      toast.success("PIN set", "You'll enter it every time money leaves KashPlus.");
      router.replace("/passkey");
    } catch {
      toast.error("Couldn't save your PIN", "Try once more.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <CreatePinScreen onDone={onDone} saving={saving} />
    </SafeAreaView>
  );
}
