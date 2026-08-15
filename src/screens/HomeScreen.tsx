import { View } from "react-native";

import { BalanceCard, type BalanceDelta } from "@/components/BalanceCard";
import {
  FeatureGrid,
  MediaCarousel,
  type Feature,
  type MediaItem,
} from "@/components/home";
import { Screen } from "@/components/ui";
import {
  features as defaultFeatures,
  media as defaultMedia,
  tagline as defaultTagline,
  portfolioDelta,
  portfolioTotal,
} from "@/data/home";
import { user } from "@/data/mock";
import { firstNameOf } from "@/lib/greeting";

/** Page gutter. The media rail escapes it, so it has to be shared. */
const GUTTER = 14;

export interface HomeScreenProps {
  name?: string;
  tagline?: string;
  /** Preformatted total across every space. */
  balance?: string;
  balanceDelta?: BalanceDelta;
  features?: Feature[];
  media?: MediaItem[];
  /** Head space — safe-area top, or a nav header's height when one floats. */
  top?: number;
  unread?: boolean;
  onNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenFeature?: (key: string) => void;
  onOpenMedia?: (key: string) => void;
  onOpenBalance?: () => void;
}

/**
 * Ecosystem home: who you are, what you're worth, the product doorways, then
 * editorial. Every section is a standalone component and every list is a prop,
 * so this file is only layout and spacing.
 */
export default function HomeScreen({
  name = firstNameOf(user.name),
  tagline = defaultTagline,
  balance = portfolioTotal,
  balanceDelta = portfolioDelta,
  features = defaultFeatures,
  media = defaultMedia,
  top = 0,
  unread = false,
  onNotifications,
  onOpenProfile,
  onOpenFeature,
  onOpenMedia,
  onOpenBalance,
}: HomeScreenProps) {
  return (
    <Screen pad={GUTTER} top={top} bottom={48}>
      <BalanceCard
        amount={balance}
        delta={balanceDelta}
        onPress={onOpenBalance}
        style={{ marginTop: 18 }}
      />

      <View style={{ marginTop: 30 }}>
        <FeatureGrid features={features} rows={[3, 2]} onOpen={onOpenFeature} />
      </View>

      {/* No section heading: the rail carries its own Podcast/News switch, and
          a title above it would be a second label for the same thing. */}
      <View style={{ marginTop: 34 }}>
        <MediaCarousel items={media} bleed={GUTTER} onOpen={onOpenMedia} />
      </View>
    </Screen>
  );
}
