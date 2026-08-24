import { View } from "react-native";

import {
  Body,
  Card,
  Label,
  Mono,
  PulseDot,
  Screen,
  TxRow,
} from "@/components/ui";
import { cn } from "@/lib/cn";

// Everything arrives formatted — the UI never does money math.
const nowStrip = [
  { caption: "KSH", figure: "$1.354", delta: "+2.1%" },
  { caption: "BTC", figure: "₦161.2M", delta: "+2.4%" },
  { caption: "LAST MAN", figure: "04:32", delta: "ROUND #63", amber: true },
];

type FeedItem = {
  icon: string;
  dir?: string;
  title: string;
  sub: string;
  amount: string;
  status?: string;
  credit?: boolean;
  pending?: boolean;
};

// Mixed feed: money, points, games, and trades interleave on one timeline.
const feed: FeedItem[] = [
  {
    icon: "↓",
    dir: "in",
    title: "Crypto deposit → ₦",
    sub: "45 USDC · Base · optimistic fill",
    amount: "+₦45,000.00",
    status: "Converting…",
    credit: true,
    pending: true,
  },
  {
    icon: "↓",
    dir: "in",
    title: "Bank transfer",
    sub: "Adebayo K. · GTBank",
    amount: "+₦120,000.00",
    credit: true,
    status: "Completed",
  },
  {
    icon: "◆",
    title: "Points earned",
    sub: "Swap on Worldstreet",
    amount: "+140 pts",
    credit: true,
  },
  {
    icon: "↗",
    title: "Amara position mirrored",
    sub: "Copy trading · SOL long ×5",
    amount: "+$4.20",
    credit: true,
  },
  {
    icon: "★",
    title: "Last Man pot grew",
    sub: "Round #63 · 47 players left",
    amount: "$1,240",
  },
  {
    icon: "↑",
    dir: "out",
    title: "Cross-border · GHS",
    sub: "Stanbic Bank Ghana",
    amount: "−₦82,300.00",
    status: "In transit",
    pending: true,
  },
  {
    icon: "◆",
    title: "KSH settlement preview",
    sub: "1,240 pts mint at settlement price",
    amount: "≈ 3.2 KSH",
    status: "Sat 00:00 UTC",
  },
];

function NowChip({
  caption,
  figure,
  delta,
  amber,
}: {
  caption: string;
  figure: string;
  delta: string;
  /** Countdown chip — the figure ticks amber with a live dot. */
  amber?: boolean;
}) {
  return (
    <Card className="flex-1 p-[12px] rounded-[16px]">
      <Label className="text-[9px]">{caption}</Label>
      <View className="flex-row items-center gap-[5px] mt-[7px]">
        <Mono className={amber ? "text-amber" : "text-text"} size={13.5}>
          {figure}
        </Mono>
        {amber ? <PulseDot size={5} /> : null}
      </View>
      <Mono
        size={10}
        className={cn("mt-[4px]", amber ? "text-dim" : "text-up")}
      >
        {delta}
      </Mono>
    </Card>
  );
}

export interface PulseScreenProps {
  /** Head space for the floating nav header. */
  top?: number;
}

/**
 * Pulse: the live wire of the ecosystem. A NOW strip of tickers up top, then
 * one mixed timeline where money, points, games, and trades land together.
 */
export default function PulseScreen({ top = 0 }: PulseScreenProps) {
  return (
    <Screen top={top}>
      <View className="mt-[10px] flex-row gap-[8px]">
        {nowStrip.map((c) => (
          <NowChip key={c.caption} {...c} />
        ))}
      </View>

      <View className="mt-[26px]">
        <Label>Activity</Label>
        {feed.map((t, i) => (
          <TxRow key={t.title} {...t} last={i === feed.length - 1} />
        ))}
      </View>

      <Body className="text-[11px] text-dim text-center mt-[18px]">
        One feed across fiat, crypto, points and games — as it happens
      </Body>
    </Screen>
  );
}
