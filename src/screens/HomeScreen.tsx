import { View } from "react-native";

import {
  FeatureShelf,
  GreetingHero,
  MediaStack,
  SpaceNav,
  type Feature,
  type MediaItem,
  type Space,
} from "@/components/home";
import { Screen } from "@/components/ui";
import {
  features as defaultFeatures,
  media as defaultMedia,
  spaces as defaultSpaces,
} from "@/data/home";
import { user } from "@/data/mock";
import { firstNameOf, greetingFor } from "@/lib/greeting";

const heroArtwork = require("../../assets/images/pills.png");

export interface HomeScreenProps {
  name?: string;
  greeting?: string;
  // heroArtwork?: ImageSource | number;
  spaces?: Space[];
  features?: Feature[];
  media?: MediaItem[];
  /** Head space for a nav header floating above the scroll view. */
  top?: number;
  unread?: boolean;
  onNotifications?: () => void;
  onSelectSpace?: (key: string) => void;
  onOpenFeature?: (key: string) => void;
  onOpenMedia?: (key: string) => void;
  onOpenHero?: () => void;
}

/**
 * Ecosystem home: greeting, the four product doorways, the promoted
 * capabilities, then editorial. Every section is a standalone component and
 * every list is a prop, so this file is only layout and spacing.
 */
export default function HomeScreen({
  name = firstNameOf(user.name),
  greeting = greetingFor(),
  spaces = defaultSpaces,
  features = defaultFeatures,
  media = defaultMedia,
  top = 0,
  onSelectSpace,
  onOpenFeature,
  onOpenMedia,
  onOpenHero,
}: HomeScreenProps) {
  return (
    <Screen pad={16} top={top} bottom={130}>
      <View style={{ marginTop: 14 }}>
        <GreetingHero
          greeting={greeting}
          name={name}
          artwork={heroArtwork}
          onPress={onOpenHero}
        />
      </View>

      <View style={{ marginTop: 18 }}>
        <SpaceNav spaces={spaces} onSelect={onSelectSpace} />
      </View>

      <View style={{ marginTop: 20 }}>
        <FeatureShelf features={features} onOpen={onOpenFeature} />
      </View>

      <View style={{ marginTop: 26 }}>
        <MediaStack items={media} onOpen={onOpenMedia} />
      </View>
    </Screen>
  );
}
