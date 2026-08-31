import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/home/ProfileHeader";
import { BadgeCheckIcon, SyncIcon } from "@/components/icons";
import {
  Body,
  Display,
  MetalButton,
  OutlineButton,
  Screen,
} from "@/components/ui";
import type { Trader } from "@/data/traders";
import { money } from "@/lib/format";
import { C } from "@/theme/tokens";

/**
 * One line of the receipt: what it is on the left, what it says on the right.
 *
 * Deliberately not `KeyValueRow`, which is the app's receipt row and rules a
 * hairline under every line of it. This card is ruled ONCE, under its title —
 * four facts about a decision that was already made read as a paragraph, not as
 * a statement of account. The right side takes a node rather than a string
 * because two of the four are not text: a portrait and a status light.
 */
function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Body className="flex-1 text-[14px] text-sub">{label}</Body>
      {children}
    </View>
  );
}

export interface CopyActivatedScreenProps {
  trader: Trader;
  /** The stake, in the account's currency — as typed on the profile. */
  amount: number;
  /**
   * The safety stop in the same currency, or `null` when the member switched it
   * off. Stated rather than derived: the floor was set on the page before this
   * one, and this page's job is to repeat what was agreed, not to recompute it.
   */
  stop?: number | null;
  onViewProfile?: () => void;
  onDashboard?: () => void;
}

/**
 * Copying activated — the last page of the copy-trading flow (PRD §F6).
 *
 * It exists to close a decision: the badge says it took, the summary says
 * exactly what took, and the two buttons are the only ways on. There is no back
 * affordance and no header on purpose — going "back" from here would land on
 * the confirm screen for a thing already confirmed.
 *
 * Every figure on it was either typed by the member (the stake) or is fixed
 * copy: Worldstreet owns the mirroring endpoints and none of them exist yet, so
 * nothing here is a report of what a server did.
 */
export default function CopyActivatedScreen({
  trader,
  amount,
  stop,
  onViewProfile,
  onDashboard,
}: CopyActivatedScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    // The page scrolls, and it has to: the summary, the two notes and the two
    // pills are ~780pt of content, which is taller than the viewport on every
    // phone the app supports.
    //
    // `top` is the status bar, not decoration. This route mounts no PageHeader
    // — that is what usually pays the top inset on a pushed page — so without
    // it the seal starts at y=0 and sits under the clock.
    <Screen pad={16} top={insets.top + 12} bottom={insets.bottom + 24}>
      <View className="items-center">
        {/* The disc is the glow, not a border: a lit face on black wants
            something under it or the seal reads as a sticker. */}
        <View className="h-[92px] w-[92px] items-center justify-center rounded-full bg-brand-glow">
          <BadgeCheckIcon size={54} color={C.brand} ink={C.brandSoftInk} />
        </View>

        <Display className="mt-[18px] text-[26px] leading-[27.3px]">
          Copying Activated!
        </Display>
        <Body className="mt-1.5 text-[14px] text-dim">
          {`You're now copying ${trader.name}`}
        </Body>
      </View>

      {/* What was agreed ---------------------------------------------------- */}
      <View className="mt-7 rounded-3xl border border-rule bg-canvas-raised p-5">
        <Body className="text-[17px] font-body-semibold">Setup Summary</Body>
        <View className="mb-2 mt-4 h-px bg-rule" />

        <SummaryRow label="Expert Trader">
          <View className="flex-row items-center gap-2.5">
            <Avatar
              source={trader.avatar}
              initial={trader.name}
              size={28}
              ringClassName="border-border"
            />
            <Body className="text-[15px] font-body-semibold">
              {trader.name}
            </Body>
          </View>
        </SummaryRow>

        {/* Brand green, matching the stake on the profile this came from. It is
            the money the member committed, never a gain — `C.up` is the token
            for those, and it is not licensed here. */}
        <SummaryRow label="Total Invested">
          <Body className="text-[15px] text-brand font-body-semibold">
            {`${money(amount)} USD`}
          </Body>
        </SummaryRow>

        <SummaryRow label="Safety Stop Loss">
          <Body
            className={`text-[15px] font-body-semibold ${
              stop == null ? "text-dim" : "text-text"
            }`}
          >
            {stop == null ? "Off" : `At ${money(stop)} USD`}
          </Body>
        </SummaryRow>

        <SummaryRow label="Strategy Status">
          <View className="flex-row items-center gap-2">
            {/* Liveness, which is what `C.green` is for — this says "running
                now", not "up". */}
            <View className="h-2 w-2 rounded-full bg-green" />
            <Body className="text-[15px] text-green font-body-semibold">
              Active
            </Body>
          </View>
        </SummaryRow>
      </View>

      {/* What happens from here --------------------------------------------- */}
      <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-rule bg-card p-4">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-card">
          <SyncIcon size={17} color={C.silver} />
        </View>
        <Body className="flex-1 text-[13px] leading-[18px] text-dim">
          {`Your portfolio will now automatically duplicate ${trader.name}'s trading positions in real-time.`}
        </Body>
      </View>

      {/* The same reassurance object as the profile screen's, so the promise
          made before the decision is the one repeated after it. */}
      <View className="mt-4 rounded-2xl border border-brand bg-brand-glow p-4">
        <Body className="text-[13.5px] leading-[19px] text-brand">
          You remain in full control. Pause, increase capital, or stop copying
          at any time from your management dashboard.
        </Body>
      </View>

      {/* Two ways on, and the quieter one is listed first: the member has just
          committed money, so the loud pill is the one that leaves them looking
          at it rather than back at the leader they left. */}
      <View className="gap-4 mt-6">
        <OutlineButton
          tone="auth"
          label="View Trader Profile"
          height={54}
          onPress={onViewProfile}
        />
        <MetalButton
          label="Go to Dashboard"
          height={54}
          onPress={onDashboard}
        />
      </View>
    </Screen>
  );
}
