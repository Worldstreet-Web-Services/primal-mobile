export const user = { name: 'Denga Kadiri', tag: '@denga', initial: 'D', va: '9012 883 774', bank: 'Rubies MFB', evm: '0x7A3fD24b81cE5501a2Fb44C09E4c88A1', sol: '9xJdW2vNqPh4tR8kFzLm3QbC5sYwQm2P' };

// The four Primal spaces (locked 2026-08-13): each is powered by one of the
// source platforms. Fiat rails and cross-border live INSIDE the LinkPay-powered
// crypto space now, not as top-level tiles.
export interface HubTile {
  key: string;
  title: string;
  powered: string;
  value: string;
  sub: string;
  delta?: string;
  badge?: string;
}

export const hubTiles: HubTile[] = [
  { key: 'earn', title: 'Auto Earn', powered: 'KASH', value: '128.40 KSH', sub: '1,240 pts settle Sat 00:00 UTC' },
  { key: 'trade', title: 'Copy Trading', powered: 'WORLDSTREET', value: '$261.20', delta: '+4.5%', sub: 'Copying Amara · 3 positions' },
  { key: 'crypto', title: 'Crypto', powered: 'LINKPAY', value: '$312.40', sub: 'ETH · SOL · USDC · 4 networks' },
  { key: 'games', title: 'Games', powered: 'ARK', value: '$85.00', badge: 'CLAIM $920', sub: 'Last Man round #63 live · 04:32' },
];

export const fiatActivity = [
  { icon: '\u2193', dir: 'in', title: 'Crypto deposit \u2192 \u20a6', sub: '45 USDC · Base · optimistic fill', amount: '+\u20a645,000.00', status: 'Converting\u2026', pending: true },
  { icon: '\u2193', dir: 'in', title: 'Bank transfer', sub: 'Adebayo K. · GTBank', amount: '+\u20a6120,000.00', credit: true, status: 'Completed' },
  { icon: '\u2191', dir: 'out', title: 'Cross-border · GHS', sub: 'Stanbic Bank Ghana', amount: '\u2212\u20a682,300.00', status: 'In transit', pending: true },
  { icon: '\u2191', dir: 'out', title: 'Send · @tobi', sub: 'In-app P2P', amount: '\u2212\u20a615,000.00', status: 'Completed' },
];

export const holdings = [
  { sym: 'ETH', name: 'Ethereum', qty: '0.031 ETH', usd: '$98.10' },
  { sym: 'SOL', name: 'Solana', qty: '0.62 SOL', usd: '$84.30' },
  { sym: 'USDC', name: 'USD Coin', qty: '130.00 USDC · Base', usd: '$130.00', green: true },
];

export const leaders = [
  { ini: 'AO', name: 'Amara Okafor', handle: '@amaratrades', win: '68%', dd: '9.2%', pnl: '+38.4%', copiers: '1,204 copying', spark: '0,18 8,15 16,16 24,10 32,12 40,7 48,9 56,4 64,6', up: true },
  { ini: 'ZM', name: 'Zainab Musa', handle: '@zainabsteady', win: '72%', dd: '3.9%', pnl: '+12.9%', copiers: '612 copying', spark: '0,14 8,13 16,12 24,12 32,10 40,10 48,9 56,8 64,7' },
  { ini: 'KA', name: 'Kwame Asante', handle: '@kwamedegen', win: '54%', dd: '21.8%', pnl: '+64.2%', copiers: '2,130 copying', spark: '0,20 8,10 16,15 24,6 32,14 40,4 48,12 56,3 64,8', up: true, risky: true },
];

export const bounties = [
  { title: 'Copy your first trader', sub: 'Any allocation counts', pts: '+750 pts' },
  { title: 'Send cross-border', sub: 'First corridor payment', pts: '+500 pts' },
  { title: 'Win a Last Man round', sub: 'Outlast the clock', pts: '+2,000 pts' },
];

export const networks = [
  { key: 'evm', label: 'EVM', addr: '0x7A3fD24b81cE5501a2Fb44C09E4c88A1', note: 'One address for Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche' },
  { key: 'sol', label: 'Solana', addr: '9xJdW2vNqPh4tR8kFzLm3QbC5sYwQm2P', note: 'SPL tokens supported' },
  { key: 'trx', label: 'Tron', addr: 'TQm4xW8pKvN2dR7hLcE9fBzA3sYw2Kd', note: 'TRC-20' },
  { key: 'btc', label: 'Bitcoin', addr: 'bc1q8w2p4kvn2dr7hlce9fbza3syw2kd94x', note: 'BTC mainnet' },
];
