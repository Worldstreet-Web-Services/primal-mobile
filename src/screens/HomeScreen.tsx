import { View } from "react-native";

import {
  FeatureTileGrid,
  GreetingBlock,
  MediaCarousel,
  PortfolioCard,
  type FeatureTileItem,
  type MediaItem,
  type PortfolioView,
} from "@/components/home";
import { Mono, Screen } from "@/components/ui";
import { media as defaultMedia } from "@/data/home";
import { C } from "@/theme/tokens";

/** Page gutter. The media rail escapes it, so it has to be shared. */
const GUTTER = 14;

/**
 * `PortfolioView` — what this screen is allowed to say about money — lives with
 * the card that renders it, in `src/components/home/PortfolioCard.tsx`. Read
 * the doctrine comment there before changing anything on this screen: it is the
 * thing standing between the member and the invented `$10,383.42` this surface
 * shipped with. Re-exported so routes can keep importing it from here.
 */
export type { PortfolioView };

/** The one label between the card and the grid. */
function SectionLabel({ children }: { children: string }) {
  return (
    <Mono size={11} color={C.dim} style={{ letterSpacing: 1.8 }}>
      {children.toUpperCase()}
    </Mono>
  );
}

export interface HomeScreenProps {
  greeting: string;
  /** First name — the greeting block has room for one line. */
  name: string;
  unread?: boolean;
  /**
   * The hero figure. Required: there is no default, because there is no truth
   * this file could supply on its own.
   */
  portfolio: PortfolioView;
  /** Eye state, hoisted so it survives this screen being remounted. */
  masked: boolean;
  onToggleMasked: () => void;
  /** The doorways, with how real each one is. Any count; the grid reflows. */
  features: FeatureTileItem[];
  media?: MediaItem[];
  sectionLabel?: string;
  /** Head space — safe-area top, or a nav header's height when one floats. */
  top?: number;
  onOpenFeature?: (key: string) => void;
  onOpenMedia?: (key: string) => void;
  onNotifications?: () => void;
  onOpenProfile?: () => void;
}

/**
 * Ecosystem home: who you are, what you hold, the product doorways, then
 * editorial. Every section is a standalone component and every list is a prop,
 * so this file is only layout and spacing — and the rule above about figures.
 */
export default function HomeScreen({
  greeting,
  name,
  unread = false,
  portfolio,
  masked,
  onToggleMasked,
  features,
  media = defaultMedia,
  sectionLabel = "Explore",
  top = 0,
  onOpenFeature,
  onOpenMedia,
  onNotifications,
  onOpenProfile,
}: HomeScreenProps) {
  return (
    <Screen pad={GUTTER} top={top} bottom={48}>
      <GreetingBlock
        greeting={greeting}
        name={name}
        unread={unread}
        onNotifications={onNotifications}
        onPressName={onOpenProfile}
      />

      <PortfolioCard
        view={portfolio}
        hidden={masked}
        onToggleHidden={onToggleMasked}
        style={{ marginTop: 18 }}
      />

      <View style={{ marginTop: 26 }}>
        <SectionLabel>{sectionLabel}</SectionLabel>
      </View>

      <View style={{ marginTop: 14 }}>
        <FeatureTileGrid items={features} onOpen={onOpenFeature} />
      </View>

      {/* No section heading: the rail carries its own Podcast/News switch, and
          a title above it would be a second label for the same thing. */}
      <View style={{ marginTop: 30 }}>
        <MediaCarousel items={media} bleed={GUTTER} onOpen={onOpenMedia} />
      </View>
    </Screen>
  );
}
