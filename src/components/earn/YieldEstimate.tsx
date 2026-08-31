import { View } from "react-native";

import { Body, KeyValueRow } from "../ui";

export interface YieldRow {
  label: string;
  /** Preformatted — the UI never does the math. */
  value: string;
  /** Paint it as money-in. Reserved for the row the glance is meant to land on. */
  accent?: boolean;
}

/** The receipt under the rate: what the entered amount earns over each period. */
export function YieldEstimate({
  title = "Estimated Yield Returns",
  rows,
}: {
  title?: string;
  rows: YieldRow[];
}) {
  return (
    <View className="rounded-[18px] border border-rule bg-canvas-raised px-[16px] pb-[4px] pt-[16px]">
      <Body className="font-body-semibold text-[15px]">{title}</Body>

      <View className="mt-[2px]">
        {rows.map((row) => (
          <KeyValueRow
            key={row.label}
            label={row.label}
            value={row.value}
            valueClassName={row.accent ? "text-up" : undefined}
          />
        ))}
      </View>
    </View>
  );
}
