/**
 * Demo data for surfaces that have no backend yet.
 *
 * `leaders` (copy-trading, a WorldStreet surface with no public routes) is the
 * ONLY export left. This file used to also carry a whole fabricated identity —
 * "Dave Kadiri", @dave, a NUBAN-shaped account number, wallet addresses — and
 * every one of those leaked onto a real screen at some point before being
 * hunted back out. Dead fabrications are one import away from shipping, so
 * they are deleted, not parked. Add mock data here only for a surface that
 * cannot exist yet, and make it self-labeling.
 */
export const leaders = [
  {
    ini: "AO",
    name: "Amara Okafor",
    handle: "@amaratrades",
    win: "68%",
    dd: "9.2%",
    pnl: "+38.4%",
    copiers: "1,204 copying",
    spark: "0,18 8,15 16,16 24,10 32,12 40,7 48,9 56,4 64,6",
    up: true,
  },
  {
    ini: "ZM",
    name: "Zainab Musa",
    handle: "@zainabsteady",
    win: "72%",
    dd: "3.9%",
    pnl: "+12.9%",
    copiers: "612 copying",
    spark: "0,14 8,13 16,12 24,12 32,10 40,10 48,9 56,8 64,7",
  },
  {
    ini: "KA",
    name: "Kwame Asante",
    handle: "@kwamedegen",
    win: "54%",
    dd: "21.8%",
    pnl: "+64.2%",
    copiers: "2,130 copying",
    spark: "0,20 8,10 16,15 24,6 32,14 40,4 48,12 56,3 64,8",
    up: true,
    risky: true,
  },
];
