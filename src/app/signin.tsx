import SignInScreen from "@/screens/SignInScreen";
import { router } from "expo-router";

export default function SignIn() {
  return <SignInScreen onSignIn={() => router.push("/(payments)/payment")} />;
}
