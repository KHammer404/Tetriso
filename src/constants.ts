export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z' | 'X';

export const COLORS: Record<PieceType | 'G', string> = {
  I: '#00ccff',
  J: '#0044ff',
  L: '#ff9900',
  O: '#ffff00',
  S: '#00ff00',
  T: '#cc00ff',
  Z: '#ff0000',
  G: '#333333', // Ghost
  X: '#555555'  // Garbage
};

export type KeyAction = 
  | 'moveLeft' 
  | 'moveRight' 
  | 'softDrop' 
  | 'rotateCW' 
  | 'rotateCCW' 
  | 'rotate180' 
  | 'hardDrop' 
  | 'hold';

export const DEFAULT_KEYS: Record<KeyAction, string> = {
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  softDrop: 'ArrowDown',
  rotateCW: 'ArrowUp',
  rotateCCW: 'KeyZ',
  rotate180: 'KeyA',
  hardDrop: 'Space',
  hold: 'KeyC',
};

export const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  X: [
    [1]
  ]
};

// SRS Wall-Kick Tables
// States: 0=Spawn, 1=CW, 2=180, 3=CCW
// Format: [prev_state, next_state]: [x, y][]
export type KickTable = Record<string, [number, number][]>;

export const SRS_KICKS: KickTable = {
  '0->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

export const SRS_KICKS_I: KickTable = {
  '0->1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2->1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2->3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0->3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export const GAME_CONFIG = {
  BOARD_WIDTH: 10,
  BOARD_HEIGHT: 20,
  VISIBLE_HEIGHT: 20,
  BUFFER_HEIGHT: 10, // Top buffer for spawning and rotations
  LOCK_DELAY: 500, // ms
  MAX_LOCK_RESETS: 15,
  GHOST_OPACITY: 0.3,
  DAS: 160, // ms
  ARR: 20, // ms
  SDF_INFINITE: true,
};
