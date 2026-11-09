// Static game data, transcribed from the rules (English UI copy). Shared by the server engine and the client.

export type RegionKey = 'oce' | 'sea' | 'chn' | 'jpk' | 'rus' | 'eeu' | 'weu' | 'nat' | 'usa' | 'cam' | 'sam' | 'afr' | 'mea' | 'cas';
export const REGIONS: Record<RegionKey, [name: string, color: number]> = {
  oce: ['Oceania', 0x41a6f6], sea: ['Southeast Asia', 0xa7f070], chn: ['China', 0xe43b44],
  jpk: ['Japan & Korea', 0xff9ec4], rus: ['Russia', 0x3b5dc9], eeu: ['Eastern Europe', 0x2fa8a0],
  weu: ['Western Europe', 0x9c5fd0], nat: ['North Atlantic', 0xb8c7d6], usa: ['United States', 0xef7d57],
  cam: ['Central America', 0xf4d35e], sam: ['South America', 0x38b764], afr: ['Africa', 0xa8683a],
  mea: ['Middle East', 0xe0a458], cas: ['Central Asia', 0xd44fa0],
};

// One entry per seat: its name and colour (the colour also picks the player's hat and hair).
export const PLAYER_DEFS = [
  { name: 'Ruby', color: 0xff4d5e }, { name: 'Azure', color: 0x4da3ff },
  { name: 'Jade', color: 0x3ddc84 }, { name: 'Amber', color: 0xffc83d },
];
export const MAX_PLAYERS = PLAYER_DEFS.length;
export const START_CASH = 20000;

export type InvestKind = 'transport' | 'build' | 'military' | 'choke' | 'oil' | 'bbc' | 'devil';
// Investment groups: shared price + effect text.
export const INVEST: Record<InvestKind, { label: string; price: number; fx: string }> = {
  transport: { label: 'Transport Co.', price: 2000, fx: 'Players landing here pay $500 / $1,000 / $2,000 when the owner holds 1 / 2 / 3 transport companies.' },
  build: { label: 'Construction Co.', price: 4000, fx: 'Owner may upgrade any city from empty land to Lv1 for free.' },
  military: { label: 'Military Base', price: 3000, fx: 'When the owner lands here, pay $500 to lower any city by 1 building level.' },
  choke: { label: 'Chokepoint', price: 1500, fx: 'Players passing or stopping here pay $200 / $300 / $400 / $500 when the owner holds 1 / 2 / 3 / 4 chokepoints.' },
  oil: { label: 'Oil Co.', price: 2000, fx: 'Owner earns $400 whenever they pass this tile.' },
  bbc: { label: 'Media', price: 3000, fx: 'Whenever anyone triggers News, owner earns $500. When the owner triggers News, they may discard it and draw again.' },
  devil: { label: 'Prison Island', price: 3000, fx: 'Whenever anyone goes to jail, owner earns $700. If the owner is jailed, they may pay $700 bail and skip the stay.' },
};

export const SPECIAL: Record<string, string> = {
  'Hong Kong': 'Charges players passing or stopping here 5% / 10% / 15% of their cash.',
  Pyongyang: 'Owner pays 10% / 15% / 20% less rent on regular cities.',
  Zurich: 'Whenever anyone gets money from the bank, owner earns $100 / $200 / $300.',
  'New York': 'Whenever anyone upgrades a city, owner earns $300 / $500 / $1,000.',
  'Las Vegas': 'Charges players stopping here dice total × $300 / $500 / $700.',
  Rio: 'Whenever anyone rolls doubles, owner earns $200 / $500 / $1,000.',
  Jerusalem: 'Owner still collects all fees while jailed. Cannot be upgraded.',
  Singapore: "Owner's rent income from regular cities +10% / +15% / +20%.",
};

// City -> country code, which picks its flag.
export const COUNTRY: Record<string, string> = {
  Wellington: 'nz', Canberra: 'au', Sydney: 'au', Jakarta: 'id', Singapore: 'sg', 'Kuala Lumpur': 'my', Bangkok: 'th', Hanoi: 'vn',
  'Hong Kong': 'hk', Shenzhen: 'cn', Taipei: 'tw', Shanghai: 'cn', Beijing: 'cn', Tokyo: 'jp', Osaka: 'jp', Seoul: 'kr', Pyongyang: 'kp',
  Vladivostok: 'ru', Yekaterinburg: 'ru', Moscow: 'ru', 'Saint Petersburg': 'ru', Warsaw: 'pl', Prague: 'cz', Vienna: 'at', Budapest: 'hu',
  Berlin: 'de', Zurich: 'ch', Paris: 'fr', Madrid: 'es', London: 'gb', Copenhagen: 'dk', Oslo: 'no', Ottawa: 'ca',
  'New York': 'us', Washington: 'us', Chicago: 'us', 'San Francisco': 'us', 'Las Vegas': 'us', 'Mexico City': 'mx', Havana: 'cu', 'San José': 'cr',
  Bogotá: 'co', 'Buenos Aires': 'ar', Rio: 'br', Brasília: 'br', Pretoria: 'za', Tunis: 'tn', Djibouti: 'dj', Cairo: 'eg',
  Jerusalem: 'il', 'Abu Dhabi': 'ae', Dubai: 'ae', Tehran: 'ir', Islamabad: 'pk', 'New Delhi': 'in', Mumbai: 'in',
};

export type PublicKind = 'start' | 'jail' | 'gojail' | 'exchange' | 'tax' | 'casino' | 'club' | 'bank' | 'news';
// Public tiles: colour + effect text.
export const PUBLIC: Record<PublicKind, { color: number; fx: string }> = {
  start: { color: 0x38b764, fx: 'Collect $3,000 when you pass or stop here.' },
  jail: { color: 0x8a8fa3, fx: 'Jailed players are sent here and skip their next turn. Stopping here does not jail you. Jailed players collect no fees.' },
  gojail: { color: 0xd9423e, fx: 'Stop here and you are sent to Jail.' },
  exchange: { color: 0x2d7d6f, fx: 'Stop here to collect (investments owned) × $500 from the bank.' },
  tax: { color: 0x7a5c3e, fx: 'Pay the bank (cities owned × $300) + (investments owned × $500).' },
  casino: { color: 0xb02a6b, fx: 'Try your luck with the dice. Beware of jail!' },
  club: { color: 0x6a3fb5, fx: 'Pay $100 and stay here for one turn (effect does not repeat).' },
  bank: { color: 0x3b7bd9, fx: 'Stop here to voluntarily mortgage your cities.' },
  news: { color: 0xe8b53a, fx: 'Stop here to trigger a random news event.' },
};
const PUBLIC_NAMES: Partial<Record<PublicKind, string>> = { start: 'START', jail: 'Jail', gojail: 'Go To Jail', tax: 'Tax Bureau', casino: 'Casino', club: 'Nightclub', bank: 'Bank', news: 'News Agency' };

export type TileType = 'city' | 'special' | 'invest' | 'public';
export type CasinoVariant = 'lucky' | 'stakes';
export interface Tile {
  i: number; type: TileType; kind: string; region: RegionKey | null; name: string;
  price: number; up: number; mort: number; variant?: CasinoVariant; color: number;
}

type Row = Omit<Tile, 'i'>;
const row = (type: TileType, kind: string, name: string, price: number, up: number, mort: number, color: number, region: RegionKey | null = null, variant?: CasinoVariant): Row =>
  ({ type, kind, region, name, price, up, mort, variant, color });
const city = (r: RegionKey, name: string, price: number) => row('city', r, name, price, price / 4, price / 2, REGIONS[r][1], r);
const special = (r: RegionKey, name: string, price: number, up: number, mort: number) => row('special', r, name, price, up, mort, REGIONS[r][1], r);
const invest = (k: InvestKind, name: string) => row('invest', k, name, INVEST[k].price, 0, 0, 0x7d8aa6);
const pub = (k: PublicKind, name = PUBLIC_NAMES[k] ?? '', variant?: CasinoVariant) => row('public', k, name, 0, 0, 0, PUBLIC[k].color, null, variant);

// The loop, clockwise from START (see the map in the rules). START is one tile; the board draws it two cells wide.
export const TILES: Tile[] = [
  pub('start'), city('oce', 'Wellington', 1600), city('oce', 'Canberra', 1800), city('oce', 'Sydney', 2600),
  city('sea', 'Jakarta', 1000), special('sea', 'Singapore', 5000, 4000, 2500), invest('choke', 'Strait of Malacca'),
  city('sea', 'Kuala Lumpur', 1400), pub('casino', undefined, 'lucky'), city('sea', 'Bangkok', 1200),
  pub('club'), city('sea', 'Hanoi', 800), pub('exchange', 'HKEX'), special('chn', 'Hong Kong', 5000, 3000, 2500),
  city('chn', 'Shenzhen', 3200), invest('build', 'CSCEC'), city('chn', 'Taipei', 2600), pub('news'),
  city('chn', 'Shanghai', 3000), invest('transport', 'China Railway'), city('chn', 'Beijing', 2800),
  city('jpk', 'Tokyo', 3500), city('jpk', 'Osaka', 2200), city('jpk', 'Seoul', 2400),
  invest('military', 'West Sea Base'), special('jpk', 'Pyongyang', 4000, 2000, 2000), pub('jail'),
  city('rus', 'Vladivostok', 800), city('rus', 'Yekaterinburg', 1000), pub('news'), city('rus', 'Moscow', 2000),
  city('rus', 'Saint Petersburg', 1600), city('eeu', 'Warsaw', 1200), city('eeu', 'Prague', 1400),
  city('eeu', 'Vienna', 2200), city('eeu', 'Budapest', 1000), pub('tax'), city('weu', 'Berlin', 2400),
  special('weu', 'Zurich', 4000, 3000, 2000), invest('build', 'VINCI'), city('weu', 'Paris', 3000), pub('bank'),
  city('weu', 'Madrid', 2000), invest('bbc', 'BBC'), city('weu', 'London', 3800), pub('exchange', 'LSE'),
  invest('transport', 'Maersk'), city('nat', 'Copenhagen', 2200), pub('news'), city('nat', 'Oslo', 2600),
  pub('gojail'), invest('choke', 'Bering Strait'), city('nat', 'Ottawa', 2000), pub('exchange', 'NASDAQ'),
  special('usa', 'New York', 5000, 4000, 2500), city('usa', 'Washington', 2800), invest('transport', 'United Airlines'),
  city('usa', 'Chicago', 2200), invest('devil', "Devil's Island"), city('usa', 'San Francisco', 4000),
  pub('casino', undefined, 'stakes'), special('usa', 'Las Vegas', 3000, 2000, 1500), pub('club'),
  invest('military', 'White Sands Base'), city('cam', 'Mexico City', 1200), city('cam', 'Havana', 600), pub('news'),
  city('cam', 'San José', 1600), invest('choke', 'Panama Canal'), city('sam', 'Bogotá', 800),
  invest('oil', 'Venezuela Oil'), city('sam', 'Buenos Aires', 1000), special('sam', 'Rio', 2000, 1800, 1000),
  city('sam', 'Brasília', 1200), city('afr', 'Pretoria', 800), pub('news'), city('afr', 'Tunis', 600),
  city('afr', 'Djibouti', 400), city('afr', 'Cairo', 1000), special('mea', 'Jerusalem', 3000, 0, 1500),
  invest('military', 'Damascus Base'), city('mea', 'Abu Dhabi', 2200), invest('oil', 'Saudi Aramco'),
  city('mea', 'Dubai', 2800), invest('choke', 'Strait of Hormuz'), city('mea', 'Tehran', 1000), pub('tax'),
  city('cas', 'Islamabad', 600), pub('news'), city('cas', 'New Delhi', 1000), city('cas', 'Mumbai', 1400),
].map((t, i) => ({ ...t, i }));

export const TILE_COUNT = TILES.length;
export const tileAt = (name: string) => TILES.findIndex((t) => t.name === name);
export const kindAt = (kind: string) => TILES.findIndex((t) => t.kind === kind);

// Regular-city numbers follow one formula in the rules table.
export const cityRent = (t: Tile) => [t.price / 10, t.price / 4, t.price / 2, t.price];
export const maxLevel = (t: Tile) => (t.type === 'city' ? 3 : t.type === 'special' ? (t.up ? 2 : 0) : 0);
export const LEVEL_NAMES = ['Empty', 'Lv 1', 'Lv 2', 'Lv 3'];
