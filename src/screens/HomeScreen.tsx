import { Pressable, View } from "react-native";

import { BalanceCard } from "@/components/BalanceCard";
import {
  FeatureGrid,
  MediaCarousel,
  type Feature,
  type MediaItem,
} from "@/components/home";
import { Body, Display, Mono, Pulse, Screen } from "@/components/ui";
import { features as defaultFeatures, media as defaultMedia } from "@/data/home";
import { C, F } from "@/theme/tokens";

/** Page gutter. The media rail escapes it, so it has to be shared. */
const GUTTER = 14;

/**
 * What the home screen is allowed to say about money — and there is no fourth
 * case on purpose.
 *
 * A figure is either one the gateway (or the chain) handed us, or it is absent
 * and said to be absent. The state this file exists to make unrepresentable is
 * the one it shipped with: a preformatted string from `src/data/home.ts`,
 * indistinguishable on screen from a real balance because the card has no way
 * to tell them apart.
 */
export type HomeFigure =
  /** Still on the wire. A skeleton, never a placeholder amount. */
  | { state: "loading" }
  /** Real, and already formatted by whoever owns the currency. */
  | { state: "figure"; label: string; currency?: string; amount: string }
  /**
   * There is no figure to show, and the reason is worth saying. An em dash and
   * a sentence — never a zero, which is itself a claim about someone's money.
   */
  | {
      state: "unavailable";
      label: string;
      currency?: string;
      note: string;
      action?: string;
      onAction?: () => void;
    };

/** The label row the card and its empty state share, so they line up exactly. */
function FigureLabel({ label, currency }: { label: string; currency?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
      <Mono size={11} color={C.dim} style={{ letterSpacing: 1.8 }}>
        {label.toUpperCase()}
      </Mono>
      {currency ? (
        <Mono size={11} color={C.brand} style={{ letterSpacing: 1.8, fontFamily: F.monoSemibold }}>
          {currency.toUpperCase()}
        </Mono>
      ) : null}
    </View>
  );
}

/**
 * The hero slab. `BalanceCard` only when there is a real figure for it to
 * hold — the other two states are drawn here rather than passed to it as a
 * string, because every string that card is given looks like money.
 */
function BalanceSlab({
  figure,
  onPress,
}: {
  figure: HomeFigure;
  onPress?: () => void;
}) {
  if (figure.state === "figure") {
    return (
      <BalanceCard
        amount={figure.amount}
        label={figure.label}
        currency={figure.currency ?? ""}
        onPress={onPress}
        style={{ marginTop: 18 }}
      />
    );
  }

  // The card's own geometry, held while the answer is in the air or missing,
  // so the page does not jump when the figure lands.
  return (
    <View style={{ marginTop: 18, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 34 }}>
      {figure.state === "loading" ? (
        <>
          <Pulse width={150} height={11} radius={5} />
          <Pulse width={230} height={40} radius={12} style={{ marginTop: 12 }} />
        </>
      ) : (
        <>
          <FigureLabel label={figure.label} currency={figure.currency} />
          <Display size={40} color={C.dim} style={{ marginTop: 6 }}>
            —
          </Display>
          <Body size={12} color={C.sub} style={{ marginTop: 10, lineHeight: 18 }}>
            {figure.note}
          </Body>
          {figure.action ? (
            <Pressable
              onPress={figure.onAction}
              accessibilityRole="button"
              style={{ marginTop: 12, alignSelf: "flex-start", paddingVertical: 4 }}
            >
              <Mono size={10} color={C.silver} style={{ letterSpacing: 1.4 }}>
                {figure.action.toUpperCase()}
              </Mono>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

/** The second space's figure, in the quiet register — one line, same rules. */
function AsideFigure({ figure }: { figure: HomeFigure }) {
  return (
    <View
      style={{
        marginTop: -14,
        marginHorizontal: 18,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: C.hairline,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      {figure.state === "loading" ? (
        <>
          <Pulse width={90} height={10} radius={5} />
          <View style={{ flex: 1 }} />
          <Pulse width={72} height={12} radius={5} />
        </>
      ) : (
        <>
          <Mono size={10} color={C.dim} style={{ letterSpacing: 1.6 }}>
            {figure.label.toUpperCase()}
          </Mono>
          <View style={{ flex: 1 }} />
          {figure.state === "figure" ? (
            <Mono size={13} color={C.silver} style={{ fontFamily: F.monoSemibold }}>
              {figure.amount}
            </Mono>
          ) : (
            // The dash carries the reason beside it, in the same breath — a
            // bare em dash reads as zero to anyone glancing.
            <>
              <Body size={11} color={C.dim} numberOfLines={1} style={{ flexShrink: 1 }}>
                {figure.note}
              </Body>
              <Mono size={13} color={C.dim}>
                —
              </Mono>
            </>
          )}
        </>
      )}
    </View>
  );
}

export interface HomeScreenProps {
  /** The hero figure. Required: there is no default, because there is no truth
   *  this file could supply on its own. */
  balance: HomeFigure;
  /** The other space's figure, in the quiet line under it. Omit to hide it. */
  aside?: HomeFigure;
  features?: Feature[];
  media?: MediaItem[];
  /** Head space — safe-area top, or a nav header's height when one floats. */
  top?: number;
  onOpenFeature?: (key: string) => void;
  onOpenMedia?: (key: string) => void;
  onOpenBalance?: () => void;
}

/**
 * Ecosystem home: what you actually hold, the product doorways, then editorial.
 * Every section is a standalone component and every list is a prop, so this
 * file is only layout, spacing, and the rule above about figures.
 */
export default function HomeScreen({
  balance,
  aside,
  features = defaultFeatures,
  media = defaultMedia,
  top = 0,
  onOpenFeature,
  onOpenMedia,
  onOpenBalance,
}: HomeScreenProps) {
  return (
    <Screen pad={GUTTER} top={top} bottom={48}>
      <BalanceSlab figure={balance} onPress={onOpenBalance} />
      {aside ? <AsideFigure figure={aside} /> : null}

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
