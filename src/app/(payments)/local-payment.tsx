import { LocalBankCheckout } from "@/components/payments";
import { router } from "expo-router";

// Standalone route for the bank checkout — see the note in `crypto-payment`.
export default function LocalPaymentScreen() {
  return (
    <LocalBankCheckout
      onBack={() => router.back()}
      onClose={() => router.dismissTo("/payment")}
    />
  );
}
