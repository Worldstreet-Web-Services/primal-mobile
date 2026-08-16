import { Pressable, View, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { C, F } from "../../theme/tokens";
import { Body, Mono, Pulse } from "../ui";

/**
 * The portfolio card, and what it is allowed to say about money.
 *
 * There is no fifth case on purpose. Every figure this card renders is one the
 * gateway or the chain handed us, already formatted by whoever owns the
 * currency — the card does no arithmetic, holds no rate, and has no default.
 * The state made unrepresentable here is the one this screen shipped with: a
 * preformatted string from `src/data/home.ts` (`portfolioTotal = "$10,383.42"`,
 * under the words TRADING BALANCE · IN USD), indistinguishable on screen from a
 * real balance because the card had no way to tell them apart.
 *
 * The two cases either side of `total` are the ones the design brief's single
 * "Total Portfolio" aggregate glosses over, and they are not errors:
 *
 * - `split` — every leg read fine, but they are denominated in different
 *   currencies and more than one is non-zero. Adding them needs an FX rate.
 *   The only NGN/USD rate in this app is `USD_NGN` in `lib/crypto/prices.ts`, a
 *   hand-typed constant whose own comment calls it a static demo value. A total
 *   built on it would be one real balance plus an invented conversion of
 *   another, which is the original lie with extra steps.
 * - `blocked` — at least one leg could not be read at all (unentitled, a 403, a
 *   chain that would not answer). An unknown leg has no size, so no total
 *   exists. The readable legs are still shown; the headline is not a number.
 *
 * `total` is therefore only reachable when every leg is readable AND at most one
 * of them is non-zero — at which point the sum needs no rate, because adding a
 * genuine zero across currencies is exact whatever the rate turns out to be.
 */
export type PortfolioView =
  /** Still on the wire. A skeleton, never a placeholder amount. */
  | { state: "loading" }
  /** A real, conversion-free total, with the legs it is made of. */
  | { state: "total"; amount: string; legs: MoneyLeg[] }
  /** Two currencies, both holding money. Shown side by side, never summed. */
  | { state: "split"; legs: MoneyLeg[]; note: string }
  /** A leg is unknowable, so the headline is an em dash and a reason. */
  | { state: "blocked"; legs: MoneyLeg[]; missing: MissingLeg[] };

export interface MoneyLeg {
  key: string;
  label: string;
  /** Preformatted upstream — this file never does the math. */
  amount: string;
}

/** A leg with no figure behind it, and which way it is missing. */
export interface MissingLeg {
  key: string;
  label: string;
  /** Written for a person: it is the only thing they will be shown. */
  note: string;
  action?: string;
  onAction?: () => void;
}

/** Radius/padding of the slab, per the client reference. */
const RADIUS = 20;
const HERO = 40;
/** The per-currency figures in `split` — still large enough for `figureTail`. */
const SPLIT = 30;
/** Room kept clear on BOTH sides of a figure, so the eye never sits on it. */
const EYE_SLOT = 34;

/**
 * The hero point size for a given figure.
 *
 * Naira balances run long — ₦12,450,000.00 is fourteen glyphs — and a fixed
 * 40pt would either collide with the eye or wrap the member's balance onto two
 * lines. Stepped off the string length rather than measured, so it is
 * deterministic and cannot flicker as digits change. Every step stays ≥24pt,
 * which is the floor `C.figureTail` is licensed at; below that the tail would
 * have to become `C.dim` and the split would stop reading.
 */
function heroSize(value: string): number {
  if (value.length > 15) return 27;
  if (value.length > 12) return 32;
  return HERO;
}

/* ------------------------------------------------------------------ pieces */

/**
 * A money figure, with its minor units dropped into `figureTail`.
 *
 * Everything goes through `Mono` (Urbanist + tabular-nums) so a balance does not
 * change width as its digits change. `figureTail` is legal here and only here:
 * both call sites are ≥24pt bold, which is the token's stated floor.
 */
function Figure({ value, size, color = C.text }: { value: string; size: number; color?: string }) {
  const dot = value.lastIndexOf(".");
  const head = dot === -1 ? value : value.slice(0, dot);
  const tail = dot === -1 ? "" : value.slice(dot);

  return (
    <Mono
      size={size}
      color={color}
      style={{ fontFamily: F.displayBold, lineHeight: size * 1.06, letterSpacing: -0.4 }}
    >
      {head}
      {tail ? (
        <Mono size={size} color={C.figureTail} style={{ fontFamily: F.displayBold }}>
          {tail}
        </Mono>
      ) : null}
    </Mono>
  );
}

/**
 * The figure with the eye closed.
 *
 * Drawn as views rather than as bullet characters so there is no text node to
 * select, long-press or copy — a masked balance that yields its digits to a
 * copy gesture is not masked. It is still only a shoulder-surfing convenience;
 * nothing here is encrypted and no copy on the card says otherwise.
 */
function MaskedFigure({ size }: { size: number }) {
  const dot = Math.max(7, Math.round(size * 0.24));
  return (
    <View
      accessible
      accessibilityLabel="Balance hidden"
      style={{
        flexDirection: "row",
        gap: dot * 0.62,
        height: size * 1.06,
        alignItems: "center",
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: C.sub }}
        />
      ))}
    </View>
  );
}

function EyeIcon({ open, size = 19, color = C.silver }: { open: boolean; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.6 12S6.3 5.9 12 5.9 21.4 12 21.4 12 17.7 18.1 12 18.1 2.6 12 2.6 12Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3.1} stroke={color} strokeWidth={1.6} />
      {open ? null : (
        <Path d="M4.4 19.6 19.6 4.4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      )}
    </Svg>
  );
}

/** The eyebrow over the figure — the card's claim about what the figure IS. */
function Eyebrow({ children }: { children: string }) {
  return (
    <Mono size={11} color={C.dim} style={{ letterSpacing: 1.8 }}>
      {children.toUpperCase()}
    </Mono>
  );
}

/**
 * One leg under the headline.
 *
 * This is the slot the client reference fills with "+12.4% (+$200.69)". That
 * delta has no source — there is no P&L endpoint on the gateway, no historical
 * balance, and nothing in the crypto store that yields a change over time — so
 * the slot carries what the app can actually prove instead: which balances the
 * headline is made of. See the note in `src/app/home.tsx`.
 */
function LegRow({ leg, hidden }: { leg: MoneyLeg; hidden: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Mono size={10} color={C.dim} style={{ letterSpacing: 1.5 }}>
        {leg.label.toUpperCase()}
      </Mono>
      <View style={{ flex: 1 }} />
      {hidden ? (
        <MaskedFigure size={11} />
      ) : (
        <Mono size={13} color={C.sub} style={{ fontFamily: F.monoSemibold }}>
          {leg.amount}
        </Mono>
      )}
    </View>
  );
}

/** A missing leg: the reason, and the one control that can change it. */
function MissingRow({ missing }: { missing: MissingLeg }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mono size={10} color={C.dim} style={{ letterSpacing: 1.5 }}>
          {missing.label.toUpperCase()}
        </Mono>
        <View style={{ flex: 1 }} />
        {/* Never a zero: a zero is itself a claim about someone's money. */}
        <Mono size={13} color={C.dim}>
          —
        </Mono>
      </View>
      <Body size={12} color={C.sub} style={{ lineHeight: 18 }}>
        {missing.note}
      </Body>
      {missing.action ? (
        <Pressable
          onPress={missing.onAction}
          accessibilityRole="button"
          hitSlop={8}
          style={{ alignSelf: "flex-start", paddingVertical: 2 }}
        >
          <Mono size={10} color={C.brand} style={{ letterSpacing: 1.4 }}>
            {missing.action.toUpperCase()}
          </Mono>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The figure, centred, with the eye hung on the card's right edge.
 *
 * The eye is positioned against this row rather than laid out beside the
 * figure, for two reasons: it stays level with the figure whatever height the
 * figure is, and it does not slide sideways as digits land or as the mask goes
 * on and off — a control that moves under the thumb between taps.
 *
 * The slot is reserved on BOTH sides. Padding only the right would centre the
 * figure off-axis; padding both keeps it optically centred in the card AND
 * keeps a long balance from running underneath the control.
 */
function FigureRow({
  children,
  eye,
}: {
  children: React.ReactNode;
  eye: React.ReactNode;
}) {
  return (
    <View
      style={{
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: EYE_SLOT,
      }}
    >
      {children}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          justifyContent: "center",
        }}
      >
        {eye}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------- card */

export interface PortfolioCardProps {
  view: PortfolioView;
  /** Session-scoped, hoisted by the route so it survives a remount. */
  hidden: boolean;
  onToggleHidden: () => void;
  style?: ViewStyle;
}

/**
 * The hero slab: a quiet label, the figure, and what sits under it.
 *
 * The eyebrow is derived rather than fixed. "Total portfolio" is a claim, and
 * it is only made over a figure that is genuinely a total — the `split` card
 * holds two balances that were deliberately not added, so it is titled as what
 * it is.
 */
export function PortfolioCard({ view, hidden, onToggleHidden, style }: PortfolioCardProps) {
  const legs = view.state === "loading" ? [] : view.legs;
  // Nothing to hide on a card with no figures on it — an eye there would be a
  // control that visibly does nothing.
  const eye =
    legs.length > 0 ? (
      <Pressable
        onPress={onToggleHidden}
        hitSlop={14}
        accessibilityRole="button"
        // "Hide", not "lock" or "protect": this stops the person beside you
        // reading the screen, and claims nothing beyond that.
        accessibilityLabel={hidden ? "Show balance" : "Hide balance"}
        style={{ padding: 6 }}
      >
        <EyeIcon open={!hidden} />
      </Pressable>
    ) : null;

  return (
    <View
      style={[
        {
          backgroundColor: C.raised,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderColor: C.hairline,
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 22,
          alignItems: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {view.state === "loading" ? (
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 4 }}>
          <Pulse width={120} height={11} radius={5} />
          <Pulse width={210} height={40} radius={12} />
          <Pulse width={168} height={12} radius={5} />
        </View>
      ) : view.state === "split" ? (
        <>
          <Eyebrow>What you hold</Eyebrow>
          {/* Two currencies, two figures, one weight. Promoting either one to
              the headline is the partial-total lie in a larger point size. */}
          <FigureRow eye={eye}>
            <View style={{ alignItems: "center", gap: 12, marginTop: 10 }}>
              {view.legs.map((leg) => (
                <View key={leg.key} style={{ alignItems: "center", gap: 3 }}>
                  {hidden ? (
                    <MaskedFigure size={SPLIT} />
                  ) : (
                    <Figure value={leg.amount} size={Math.min(SPLIT, heroSize(leg.amount))} />
                  )}
                  <Mono size={10} color={C.dim} style={{ letterSpacing: 1.5 }}>
                    {leg.label.toUpperCase()}
                  </Mono>
                </View>
              ))}
            </View>
          </FigureRow>
          <Body
            size={12}
            color={C.sub}
            style={{ marginTop: 16, lineHeight: 18, textAlign: "center" }}
          >
            {view.note}
          </Body>
        </>
      ) : view.state === "total" ? (
        <>
          <Eyebrow>Total portfolio</Eyebrow>
          <FigureRow eye={eye}>
            <View style={{ marginTop: 8 }}>
              {hidden ? (
                <MaskedFigure size={HERO} />
              ) : (
                <Figure value={view.amount} size={heroSize(view.amount)} />
              )}
            </View>
          </FigureRow>
          {/* The reference's delta slot, carrying what the total is made of.
              See the `LegRow` note on why it is not a percentage. */}
          <View style={{ alignSelf: "stretch", marginTop: 18, gap: 9 }}>
            {view.legs.map((leg) => (
              <LegRow key={leg.key} leg={leg} hidden={hidden} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Eyebrow>Total portfolio</Eyebrow>
          <FigureRow eye={eye}>
            {/* The em dash IS the answer: a total that cannot be computed is
                not zero, and the sentences below say which leg is missing. */}
            <Mono size={HERO} color={C.dim} style={{ fontFamily: F.displayBold, marginTop: 8 }}>
              —
            </Mono>
          </FigureRow>
          <View style={{ alignSelf: "stretch", marginTop: 16, gap: 14 }}>
            {view.legs.map((leg) => (
              <LegRow key={leg.key} leg={leg} hidden={hidden} />
            ))}
            {view.missing.map((m) => (
              <MissingRow key={m.key} missing={m} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
