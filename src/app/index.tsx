import { Redirect } from "expo-router";
import { View } from "react-native";

import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import { C } from "@/theme/tokens";

/**
 * Entry gate. Reads the restored session and sends the user to the one screen
 * that matches their state, so a returning user never sees the welcome screen
 * flash before being redirected past it.
 */
export default function Index() {
  const { status, step } = useAuth();

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.canvas,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size="large" color={C.silver} />
      </View>
    );
  }

  if (status === "signedOut") return <Redirect href="/welcome" />;
  if (status === "locked") return <Redirect href="/unlock" />;
  if (status === "onboarding") {
    return <Redirect href={step === "passkey" ? "/passkey" : "/pin"} />;
  }
  return <Redirect href="/home" />;
}
