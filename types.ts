
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

export type Language = 'EN' | 'IT';

export enum PowerUpType {
  SHIELD = 'SHIELD',
  MAGNET = 'MAGNET'
}

export interface PowerUpLevels {
  SHIELD: number;
  MAGNET: number;
}

export interface CarStats {
  speed: number;    // Level 1-5: Affects acceleration and top speed cap
  handling: number; // Level 1-5: Affects lane change speed (lerp)
}

export interface CarConfig {
  id: string;
  color: string;
  rarity: CarRarity;
  stats: CarStats;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Size3 {
  width: number;
  height: number;
  depth: number;
}

export interface Entity extends Vector3, Size3 {
  color: string;
  velocity: Vector3;
}

export interface Player extends Entity {
  targetX: number; // For Lerp movement
  tilt: number;    // Visual tilt effect
}

export type CarRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export interface CarModel {
  id: string;
  name: string;
  description: string;
  color: string; // Default color
  emissive: string;
  type: 'RACER' | 'TANK' | 'GHOST';
  rarity: CarRarity;
  price: number; // Cost to unlock
  currency?: 'CREDITS' | 'GEMS'; // Default is CREDITS
}

export enum MissionType {
  COLLECT_COINS = 'COLLECT_COINS',
  SCORE_POINTS = 'SCORE_POINTS',
  REACH_MULTIPLIER = 'REACH_MULTIPLIER',
  PLAY_GAMES = 'PLAY_GAMES'
}

export interface Mission {
  id: string;
  type: MissionType;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  reward: number; // Gems
}