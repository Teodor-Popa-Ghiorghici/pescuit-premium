// Pure types for the Pescuiește Extins rules engine.
// No network / UI imports allowed anywhere in this package.

export const POWER_RANKS = [
  'squid',
  'shark',
  'tortoise',
  'jellyfish',
  'lanternfish',
  'stickleback',
  'mantisShrimp',
  'whale',
  'clownfish',
] as const;
export type PowerRank = (typeof POWER_RANKS)[number];

export const NORMAL_RANKS = [
  'herring',
  'mackerel',
  'anchovy',
  'sardine',
  'carp',
  'trout',
  'perch',
  'catfish',
] as const;
export type NormalRank = (typeof NORMAL_RANKS)[number];

export const EGGS = 'eggs' as const;

export type Rank = PowerRank | NormalRank | typeof EGGS;

export interface Card {
  id: string;
  rank: Rank;
}

export type PowerVisibilityMode = 'ascuns' | 'deschis';

export interface TortoiseProtection {
  id: string;
  ownerId: string;
  rank: Rank;
  /** protection is cleared when this player's next turn starts */
  expiresAtNextTurnOf: string;
}

export interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  connected: boolean;
  /** true if this player's next turn should be skipped (jellyfish) */
  stunned: boolean;
}

export interface LaidSet {
  id: string;
  ownerId: string;
  rank: Rank;
  cardIds: string[];
  eggCount: number;
  isPowerSet: boolean;
  /** face-up = power visible/usable openly, depends on mode + squid exception */
  faceUp: boolean;
  /** power has been used or destroyed and can never be used again */
  spent: boolean;
  destroyedByMantis: boolean;
}

export interface PowerGrant {
  id: string;
  ownerId: string;
  /** the power this grant lets you use. 'clownfish' while unbound. */
  rank: PowerRank;
  sourceSetId: string;
  used: boolean;
  /** false only for an unbound clownfish grant */
  bound: boolean;
  /** true if this grant is itself a (bound) clownfish copy of another power */
  isClownfishCopy: boolean;
}

export type WindowType =
  | 'TURN_START'
  | 'REQUEST_DECLARED'
  | 'RESPONSE_PENDING'
  | 'TRANSFER_PENDING'
  | 'SET_COMPLETED'
  | 'TURN_END';

export interface PendingWindow {
  type: WindowType;
  eligiblePlayerIds: string[];
  context: Record<string, unknown>;
}

export type TransferOutcome = 'success' | 'fail' | 'reflected_success' | 'reflected_fail' | 'blocked';

export interface RequestResume {
  askerId: string;
  targetId: string;
  rank: Rank;
  reflectedTo?: string;
  outcome?: TransferOutcome;
  movingCardIds?: string[];
  loserId?: string;
  gainerId?: string;
}

export type ResumeState =
  | { kind: 'AWAIT_REQUEST'; playerId: string }
  | { kind: 'REQUEST_DECLARED'; request: RequestResume }
  | { kind: 'RESPONSE_PENDING'; request: RequestResume; trueHasCards: boolean }
  | { kind: 'TRANSFER_PENDING'; request: RequestResume }
  | { kind: 'TURN_END'; request: RequestResume }
  | { kind: 'NONE' };

export interface GameConfig {
  powerVisibility: PowerVisibilityMode;
  /** milliseconds a driver should wait before auto-closing a window. Informational only; engine does not use timers. */
  windowTimeoutMs: number;
}

export interface GameState {
  seed: number;
  rngState: number;
  players: PlayerState[];
  turnOrder: string[];
  pool: Card[];
  currentPlayerIndex: number;
  turnCounter: number;
  pendingWindow: PendingWindow | null;
  resume: ResumeState;
  tortoiseProtections: TortoiseProtection[];
  laidSets: LaidSet[];
  powerGrants: PowerGrant[];
  pendingClownfishBindings: string[];
  usedPowerHistory: { rank: PowerRank; grantId: string; wasClownfishCopy: boolean }[];
  status: 'IN_PROGRESS' | 'ENDED';
  winners: string[];
  config: GameConfig;
  /** monotonically increasing id counter for generating unique ids deterministically */
  idCounter: number;
  /** consecutive requests resolved with zero effect (no capture, no draw); see DECISIONS.md */
  staleRequestStreak: number;
}

// ---- Actions ----

export type Action =
  | { type: 'REQUEST'; playerId: string; targetId: string; rank: Rank }
  | { type: 'LAY_SET'; playerId: string; rank: Rank; cardIds: string[] }
  | { type: 'USE_JELLYFISH'; playerId: string; grantId: string; targetId: string }
  | { type: 'USE_STICKLEBACK'; playerId: string; grantId: string; targetId: string; rank: NormalRank }
  | { type: 'USE_WHALE'; playerId: string; grantId: string; targetAId: string; targetBId: string }
  | { type: 'DECLARE_LANTERNFISH'; playerId: string; grantId: string }
  | { type: 'DECLARE_SQUID'; playerId: string; grantId: string; lie: 'deny' | 'claim' }
  | { type: 'DECLARE_TORTOISE'; playerId: string; grantId: string; rank: Rank }
  | { type: 'DECLARE_MANTIS'; playerId: string; grantId: string }
  | { type: 'DECLARE_SHARK'; playerId: string; grantId: string }
  | { type: 'SKIP_WINDOW' };

// ---- Events (authoritative, full-information log kept by the engine) ----
// Squid is deliberately absent from this union: no event of any kind is ever
// emitted for a squid declaration. See DECISIONS.md.

export type GameEvent =
  | { type: 'GAME_STARTED'; playerIds: string[]; seed: number }
  | { type: 'TURN_STARTED'; playerId: string; turn: number }
  | { type: 'TURN_SKIPPED_STUNNED'; playerId: string }
  | { type: 'HAND_REFILLED'; playerId: string; count: number }
  | { type: 'WINDOW_OPENED'; window: WindowType; eligiblePlayerIds: string[]; context: Record<string, unknown> }
  | { type: 'WINDOW_CLOSED'; window: WindowType }
  | { type: 'REQUEST_MADE'; askerId: string; targetId: string; rank: Rank }
  | { type: 'REQUEST_SUCCEEDED'; askerId: string; targetId: string; rank: Rank; count: number }
  | { type: 'REQUEST_FAILED'; askerId: string; targetId: string; rank: Rank }
  | { type: 'DREW_FROM_POOL'; playerId: string; cardId: string; poolEmpty: boolean }
  | { type: 'SET_LAID'; playerId: string; setId: string; rank: Rank; isPowerSet: boolean; eggCount: number }
  | { type: 'SET_DESTROYED'; setId: string; byPlayerId: string }
  | { type: 'POWER_GRANTED'; playerId: string; grantId: string; rank: PowerRank; sourceSetId: string; unbound: boolean }
  | { type: 'POWER_USED'; playerId: string; grantId: string; rank: PowerRank }
  | { type: 'CLOWNFISH_BOUND'; playerId: string; grantId: string; boundRank: PowerRank }
  | { type: 'SHARK_JUMP'; playerId: string; fromId: string; rank: Rank; count: number }
  | { type: 'LANTERNFISH_REFLECT'; playerId: string; fromId: string; rank: Rank; count: number }
  | { type: 'TORTOISE_BLOCK'; playerId: string; rank: Rank }
  | { type: 'JELLYFISH_STUN'; playerId: string; targetId: string }
  | { type: 'STICKLEBACK_STEAL'; playerId: string; targetId: string; rank: Rank; count: number }
  | { type: 'STICKLEBACK_WASTED'; playerId: string; targetId: string; rank: Rank }
  | { type: 'WHALE_SHUFFLE'; playerId: string; targetAId: string; targetBId: string }
  | { type: 'BONUS_TURN'; playerId: string }
  | { type: 'GAME_ENDED'; scores: Record<string, number>; winners: string[] };
