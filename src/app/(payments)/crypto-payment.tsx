import { CryptoCheckout } from "@/components/payments";
import { router } from "expo-router";

// Standalone route for the crypto checkout. The funding-options flow no longer
// comes through here — it raises the same component in a sheet — but the route
// is kept so the checkout stays deep-linkable.
export default function CryptoPaymentScreen() {
  return (
    <CryptoCheckout
      onBack={() => router.back()}
      onClose={() => router.dismissTo("/payment")}
    />
  );
}
