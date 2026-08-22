import { View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
import { Body, PressableScale } from "../ui";

/**
 * One thing that happened, as this screen is allowed to describe it.
 *
 * `title` says WHAT, `note` says how much and to what, `when` says when. There
 * is deliberately no amount field of its own: an amount rendered in its own
 * column, right-aligned in a money colour, is a figure the screen is vouching
 * for. Inside the sentence it is quoting whoever produced the event. The
 * distinction sounds thin until you remember what this screen used to print in
 * its largest type — see the doctrine note in `PortfolioCard`.
 */
export interface ActivityItem {
  key: string;
  title: string;
  /** The sentence under the title. Written upstream, rendered verbatim. */
  note: string;
  /** Preformatted and relative — "10m ago", "1d ago". */
  when: string;
  /**
   * Marks the entry as the live one — the reference greens its first row. It
   * says "this just happened", never "this made money", so it is not applied
   * by sign: a withdrawal that just landed is as highlighted as a credit.
   */
  fresh?: boolean;
  onPress?: () => void;
}

function Row({ item, last }: { item: ActivityItem; last: boolean }) {
  const body = (
    <View
      style={{
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
        gap: 5,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Body
          semibold
          size={14.5}
          numberOfLines={1}
          color={item.fresh ? C.green : C.text}
          style={{ flex: 1, letterSpacing: 0.1 }}
        >
          {item.title}
        </Body>
        {/* Tabular figures would be wrong here: "10m ago" is prose, not a
            column, and the times never have to line up with each other. */}
        <Body size={12.5} color={C.dim}>
          {item.when}
        </Body>
      </View>
      <Body
        size={13}
        color={C.dim}
        numberOfLines={2}
        style={{ lineHeight: 18 }}
      >
        {item.note}
      </Body>
    </View>
  );

  if (!item.onPress) return body;
  return (
    <PressableScale
      onPress={item.onPress}
      scale={0.99}
      accessibilityLabel={item.title}
    >
      {body}
    </PressableScale>
  );
}

/**
 * Recent activity, as one slab of rows.
 *
 * The empty state is the honest default and not a failure: this app has no
 * transaction feed behind it yet — the gateway surface is `/v1/auth/*`,
 * `/v1/linkpay/*` and `/v1/subscriptions/*`, none of which returns a ledger —
 * so with nothing passed in, the card says so in a sentence rather than filling
 * itself with plausible rows. Plausible rows about someone's money are the one
 * thing this screen must never invent. See `src/app/home.tsx`.
 */
export function ActivityCard({
  items,
  empty = "Nothing has moved yet. Deposits, transfers and trades show up here as they happen.",
  style,
}: {
  items: ActivityItem[];
  /** What stands in when there is no history. Written for a person. */
  empty?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: C.raised,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: C.hairline,
          paddingHorizontal: 16,
          paddingVertical: 2,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {items.length === 0 ? (
        <Body
          size={13}
          color={C.dim}
          style={{ lineHeight: 19, paddingVertical: 18 }}
        >
          {empty}
        </Body>
      ) : (
        items.map((item, i) => (
          <Row key={item.key} item={item} last={i === items.length - 1} />
        ))
      )}
    </View>
  );
}

/** The label over a section of the page — sentence case, per the reference. */
export function SectionTitle({
  children,
  style,
}: {
  children: string;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      <Body size={17} color={C.sub} style={{ fontFamily: F.bodyMedium }}>
        {children}
      </Body>
    </View>
  );
}
