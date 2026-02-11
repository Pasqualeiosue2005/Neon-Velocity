
import { CarModel } from './types';

export const COLORS = {
  background: '#050510',
  player: '#00f3ff',
  enemy: '#ff0055',
  enemyEmissive: '#aa0033',
  coin: '#ffd700',   // Gold
  coinEmissive: '#ffaa00',
  gem: '#f43f5e',    // Ruby/Neon Red for Gems
  gemEmissive: '#ff0033',
  shield: '#00ffff', // Cyan
  magnet: '#ff00ff', // Magenta
  grid: '#ba00ff',
  text: '#ffffff',
  accent: '#facc15'
};

export const NEON_PALETTE = [
  '#00f3ff', // Cyan (Default)
  '#ff0055', // Neon Red
  '#9d00ff', // Purple
  '#00ff66', // Green
  '#ffaa00', // Orange
  '#ffffff', // White
  '#ffff00', // Yellow
  '#ff00ff', // Magenta
  '#ffe135', // Banana Yellow
];

export const UPGRADE_COSTS = {
  SPEED: 400,
  HANDLING: 400,
  COLOR: 0 // Free
};

export const RARITY_COLORS = {
  COMMON: '#9ca3af',   // Gray
  RARE: '#3b82f6',     // Blue
  EPIC: '#a855f7',     // Purple
  LEGENDARY: '#eab308', // Gold
  MYTHIC: '#f43f5e'    // Red/Gem
};

export const TRANSLATIONS = {
  EN: {
    START_RACE: "START RACE",
    GARAGE: "GARAGE",
    TECH_LAB: "TECH LAB",
    SETTINGS: "SETTINGS",
    LOCKED_GARAGE: "LOCKED (GO TO GARAGE)",
    BACK: "BACK",
    LOCKED: "LOCKED",
    PURCHASE: "PURCHASE",
    SELECT_RACE: "SELECT & RACE",
    TOP_SPEED: "TOP SPEED",
    HANDLING: "HANDLING",
    UPGRADE: "UPGRADE",
    PAINT_SHOP: "PAINT SHOP",
    MAXED: "MAXED OUT",
    SHIELD_DESC: "Increases the active duration of the shield.",
    MAGNET_DESC: "Increases the active duration of the coin magnet.",
    SCORE: "Score",
    HIGH_SCORE: "High Score",
    SYSTEM_PAUSED: "SYSTEM PAUSED",
    RESUME: "RESUME",
    RESTART: "RESTART",
    QUIT_MENU: "QUIT TO MENU",
    CRASHED: "CRASHED",
    SYSTEM_FAILURE: "System Failure",
    DISTANCE: "Distance",
    EARNED: "Earned",
    PEAK_MULTIPLIER: "Peak Multiplier",
    NEW_RECORD: "NEW RECORD",
    BEST: "Best",
    TOTAL_BALANCE: "Total Balance",
    MENU: "MENU",
    REBOOT: "REBOOT SYSTEM",
    VOLUME: "VOLUME",
    LANGUAGE: "LANGUAGE",
    CLASS: "CLASS",
    RARITY: "RARITY",
    SHIELD_DUR: "SHIELD DURATION",
    MAGNET_DUR: "MAGNET DURATION",
    R_COMMON: "COMMON",
    R_RARE: "RARE",
    R_EPIC: "EPIC",
    R_LEGENDARY: "LEGENDARY",
    R_MYTHIC: "MYTHIC",
    INSUFFICIENT_FUNDS: "INSUFFICIENT FUNDS"
  },
  IT: {
    START_RACE: "INIZIA GARA",
    GARAGE: "GARAGE",
    TECH_LAB: "LABORATORIO",
    SETTINGS: "IMPOSTAZIONI",
    LOCKED_GARAGE: "BLOCCATO (VAI AL GARAGE)",
    BACK: "INDIETRO",
    LOCKED: "BLOCCATO",
    PURCHASE: "ACQUISTA",
    SELECT_RACE: "SELEZIONA & CORRI",
    TOP_SPEED: "VELOCITÀ MAX",
    HANDLING: "MANOVRABILITÀ",
    UPGRADE: "POTENZIA",
    PAINT_SHOP: "VERNICIATURA",
    MAXED: "AL MASSIMO",
    SHIELD_DESC: "Aumenta la durata attiva dello scudo.",
    MAGNET_DESC: "Aumenta la durata attiva del magnete.",
    SCORE: "Punteggio",
    HIGH_SCORE: "Record",
    SYSTEM_PAUSED: "SISTEMA IN PAUSA",
    RESUME: "RIPRENDI",
    RESTART: "RIAVVIA",
    QUIT_MENU: "ESCI AL MENU",
    CRASHED: "SCHIANTATO",
    SYSTEM_FAILURE: "Fallimento Sistema",
    DISTANCE: "Distanza",
    EARNED: "Guadagnati",
    PEAK_MULTIPLIER: "Moltiplicatore Max",
    NEW_RECORD: "NUOVO RECORD",
    BEST: "Migliore",
    TOTAL_BALANCE: "Saldo Totale",
    MENU: "MENU",
    REBOOT: "RIAVVIA SISTEMA",
    VOLUME: "VOLUME",
    LANGUAGE: "LINGUA",
    CLASS: "CLASSE",
    RARITY: "RARITÀ",
    SHIELD_DUR: "DURATA SCUDO",
    MAGNET_DUR: "DURATA MAGNETE",
    R_COMMON: "COMUNE",
    R_RARE: "RARO",
    R_EPIC: "EPICO",
    R_LEGENDARY: "LEGGENDARIO",
    R_MYTHIC: "MITICO",
    INSUFFICIENT_FUNDS: "SALDO INSUFFICIENTE"
  }
};

// Single Progressive Mode Configuration
export const SCALING_CONFIG = {
  startSpeed: 0.8,
  maxSpeed: 15.0,
  acceleration: 0.0005,
};

export const CAR_MODELS: CarModel[] = [
  // --- COMMON (Entry Level) ---
  {
    id: 'c_mini',
    name: 'MINI COOPER S',
    description: 'Iconic widebody hatchback. Small but fierce.',
    color: '#ffffff', // Classic White/Red
    emissive: '#ffaaaa',
    type: 'RACER',
    rarity: 'COMMON',
    price: 0
  },
  {
    id: 'c_bmw_m3',
    name: 'BMW M3 E46',
    description: 'The ultimate driving machine. Inline-6 scream.',
    color: '#0033aa', // Laguna Seca Blue
    emissive: '#4477ff',
    type: 'RACER',
    rarity: 'COMMON',
    price: 1000
  },
  {
    id: 'c_civic',
    name: 'HONDA CIVIC EK9',
    description: 'VTEC kicks in! High-revving FWD hero.',
    color: '#ffff00', // Sunlight Yellow
    emissive: '#ffffaa',
    type: 'RACER',
    rarity: 'COMMON',
    price: 1800
  },

  // --- RARE (Mid-tier) ---
  {
    id: 'c_s2000',
    name: 'HONDA S2000',
    description: '9000 RPM redline roadster. Precision machine.',
    color: '#cccccc', // Silverstone Metallic
    emissive: '#ffffff',
    type: 'RACER',
    rarity: 'RARE',
    price: 3500
  },
  {
    id: 'c_silvia',
    name: 'NISSAN SILVIA S15',
    description: 'The drift beauty. Sleek lines and turbo power.',
    color: '#00ccff', // Blue
    emissive: '#aaeeff',
    type: 'RACER',
    rarity: 'RARE',
    price: 4500
  },
  {
    id: 'c_evo',
    name: 'MITSUBISHI EVO VI',
    description: 'Rally-bred sedan with advanced AWD.',
    color: '#ffffff', // Scotia White
    emissive: '#dddddd',
    type: 'RACER',
    rarity: 'RARE',
    price: 6000
  },
  {
    id: 'c_impreza',
    name: 'SUBARU IMPREZA 22B',
    description: 'Widebody rally icon. The boxer rumble legendary.',
    color: '#0033ff', // WR Blue
    emissive: '#4477ff',
    type: 'RACER',
    rarity: 'RARE',
    price: 9500
  },
  {
    id: 'c_ae86',
    name: 'TOYOTA AE86',
    description: 'Tofu delivery special. The drift legend.',
    color: '#ffffff', // Black/White
    emissive: '#dddddd',
    type: 'RACER',
    rarity: 'RARE',
    price: 11000
  },
  {
    id: 'c_r32',
    name: 'NISSAN SKYLINE R32',
    description: 'The original Godzilla. Group A dominator.',
    color: '#333333', // Gun Grey
    emissive: '#555555',
    type: 'RACER',
    rarity: 'RARE',
    price: 12500
  },

  // --- EPIC (High Performance) ---
  {
    id: 'c_350z',
    name: 'NISSAN 350Z',
    description: 'Modern drift muscle with V6 torque.',
    color: '#ff8800', // Sunset Orange
    emissive: '#ffaa44',
    type: 'RACER',
    rarity: 'EPIC',
    price: 15000
  },
  {
    id: 'c_rx7',
    name: 'MAZDA RX-7 FD',
    description: 'Rotary power and timeless curves.',
    color: '#ffff00', // Competition Yellow
    emissive: '#ffffaa',
    type: 'RACER',
    rarity: 'EPIC',
    price: 18000
  },
  {
    id: 'c_jeep_wrangler',
    name: 'OFFROAD KING',
    description: 'Go anywhere. Doors off, roof off.',
    color: '#445500', // Sarge Green
    emissive: '#889900',
    type: 'TANK',
    rarity: 'EPIC',
    price: 20000
  },
  {
    id: 'c_police_interceptor',
    name: 'INTERCEPTOR',
    description: 'To protect and swerve. Siren included.',
    color: '#000000', // Black & White handled in geometry usually, but base black
    emissive: '#0000ff', // Blue lights
    type: 'RACER',
    rarity: 'EPIC',
    price: 22000
  },
  {
    id: 'c_nsx',
    name: 'HONDA NSX NA1',
    description: 'Japanese mid-engine supercar precision.',
    color: '#cc0000', // Formula Red
    emissive: '#ff3333',
    type: 'RACER',
    rarity: 'EPIC',
    price: 25000
  },
  {
    id: 'c_viper',
    name: 'DODGE VIPER GTS',
    description: '8.0L V10. No assists. Pure danger.',
    color: '#0000cc', // GTS Blue with strips
    emissive: '#4444ff',
    type: 'RACER',
    rarity: 'EPIC',
    price: 28000
  },


  // --- LEGENDARY (The Kings) ---
  {
    id: 'c_gtr_r34',
    name: 'NISSAN GTR R34',
    description: 'Godzilla. The ultimate AWD street weapon.',
    color: '#0000cc', // Bayside Blue
    emissive: '#4444ff',
    type: 'RACER',
    rarity: 'LEGENDARY',
    price: 35000
  },

  {
    id: 'c_peterbilt',
    name: 'THE HAULER',
    description: 'American muscle. 18 wheels of freedom.',
    color: '#aa0000', // Optimus? Nah, deep red
    emissive: '#ffaa00',
    type: 'TANK',
    rarity: 'LEGENDARY',
    price: 40000
  },

  {
    id: 'c_f40',
    name: 'FERRARI F40',
    description: 'The raw driving machine. Twin-turbo V8 legend.',
    color: '#ff0000', // Rosso Corsa
    emissive: '#ff4444',
    type: 'RACER',
    rarity: 'LEGENDARY',
    price: 60000 // Reverting this one slightly higher as it is iconic, but 10x coin value makes it reachable
  },
  {
    id: 'c_p1',
    name: 'MCLAREN P1',
    description: 'Hybrid hypercar. Organic curves and instant torque.',
    color: '#ff8800', // Volcano Orange
    emissive: '#ffaa44',
    type: 'RACER',
    rarity: 'LEGENDARY',
    price: 80000 // Keeping high
  },
  {
    id: 'c_porsche_gt3_touring',
    name: 'PORSCHE 911 TOURING',
    description: 'Wingless purity. The gentleman\'s GT3.',
    color: '#333333', // Agate Grey
    emissive: '#aaaaaa',
    type: 'RACER',
    rarity: 'LEGENDARY',
    price: 90000
  },
  {
    id: 'c_porsche_gt3_rs',
    name: 'PORSCHE 911 GT3 RS',
    description: 'Track weapon. DRS enabled.',
    color: '#44cc44', // Python Green
    emissive: '#88ff88',
    type: 'RACER',
    rarity: 'LEGENDARY',
    price: 100000
  },
  {
    id: 'c_f1',
    name: 'MCLAREN F1',
    description: 'The greatest driver\'s car ever built. Gold engine bay.',
    color: '#888888', // Magnesium Silver
    emissive: '#aaaaaa',
    type: 'RACER',
    rarity: 'LEGENDARY',
    price: 120000
  },
  {
    id: 'c_porsche_gt3_mr',
    name: 'PORSCHE 911 MR',
    description: 'Manthey Racing Kit. Ring record holder.',
    color: '#ff0055', // Ruby Star
    emissive: '#ff88aa',
    type: 'RACER',
    rarity: 'LEGENDARY',
    price: 140000
  },

  // --- MYTHIC (Bonus) ---
  {
    id: 'c_ferrari_499p',
    name: 'FERRARI 499P',
    description: 'Le Mans Hypercar. 100 years of racing history.',
    color: '#cc0000', // Rosso Corsa
    emissive: '#ffff00', // Yellow accents
    type: 'RACER',
    rarity: 'MYTHIC',
    price: 100, // Gems
    currency: 'GEMS'
  },
  {
    id: 'c_m1_abrams',
    name: 'THE TANK',
    description: 'Traffic? What traffic?',
    color: '#4b5320', // Olive Drab
    emissive: '#667733',
    type: 'TANK',
    rarity: 'MYTHIC',
    price: 150, // Gems
    currency: 'GEMS'
  },
  {
    id: 'c_formula1',
    name: 'FORMULA 1',
    description: 'The pinnacle of motorsport. Open wheels, halo, and DRS.',
    color: '#ff0000', // Classic Red (Ferrari style)
    emissive: '#ff4444',
    type: 'RACER',
    rarity: 'MYTHIC',
    price: 200, // Gems
    currency: 'GEMS'
  },
  {
    id: 'c_fighter_jet',
    name: 'FIGHTER JET',
    description: 'Top Gun stuff. Why drive when you can fly?',
    color: '#334455',
    emissive: '#00ffff',
    type: 'RACER',
    rarity: 'MYTHIC',
    price: 500, // Gems
    currency: 'GEMS'
  }
];

// World Units (Not Pixels)
export const GAME_CONFIG = {
  laneCount: 3, // MOBILE OPTIMIZED
  laneWidth: 6.0, // Slightly wider for comfort

  // Dimensions 
  playerWidth: 2,
  playerHeight: 1,
  playerDepth: 3.5,

  enemyWidth: 2,
  enemyHeight: 1.2,
  enemyDepth: 3.5,

  coinSize: 0.8,

  spawnDistance: -300,
  despawnZ: 30,

  coinSpawnRate: 60,
  spawnRateInitial: 35,
  coinValue: 10,

  // Power Ups
  magnetDuration: 600,
  powerUpSpawnRate: 400,
};

export const RARITY_BONUS = {
  COMMON: { coinMult: 1.0, shieldMult: 1.0, multSpeed: 1.0, gemChance: 0.0 },
  RARE: { coinMult: 1.1, shieldMult: 1.0, multSpeed: 1.0, gemChance: 0.0 },     // +10% Credits
  EPIC: { coinMult: 1.0, shieldMult: 1.5, multSpeed: 1.0, gemChance: 0.0 },     // +50% Shield Duration
  LEGENDARY: { coinMult: 1.0, shieldMult: 1.0, multSpeed: 1.5, gemChance: 0.0 }, // +50% Multiplier Gain 
  MYTHIC: { coinMult: 1.0, shieldMult: 1.0, multSpeed: 1.5, gemChance: 0.02 }   // +2% Gem Chance per spawn check
};