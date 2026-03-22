import { GAME_CONFIG } from '../constants';
import type { PieceType } from '../constants';
import { Piece } from './Piece';

export type Cell = PieceType | null;

export class Board {
  width: number;
  height: number;
  grid: Cell[][];

  constructor(width = GAME_CONFIG.BOARD_WIDTH, height = GAME_CONFIG.BOARD_HEIGHT + GAME_CONFIG.BUFFER_HEIGHT) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => Array(width).fill(null));
  }

  isValidMove(piece: Piece, offsetX = 0, offsetY = 0, newShape?: number[][]): boolean {
    const shape = newShape || piece.getBlocks();
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardX = piece.x + x + offsetX;
          const boardY = piece.y + y + offsetY;

          if (
            boardX < 0 ||
            boardX >= this.width ||
            boardY < 0 ||
            boardY >= this.height ||
            (boardY >= 0 && this.grid[boardY][boardX] !== null)
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  lockPiece(piece: Piece) {
    const shape = piece.getBlocks();
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardX = piece.x + x;
          const boardY = piece.y + y;
          if (boardY >= 0 && boardY < this.height) {
            this.grid[boardY][boardX] = piece.type;
          }
        }
      }
    }
  }

  clearLines(): number {
    let linesCleared = 0;
    for (let y = this.height - 1; y >= 0; y--) {
      if (this.grid[y].every((cell) => cell !== null)) {
        this.grid.splice(y, 1);
        this.grid.unshift(Array(this.width).fill(null));
        linesCleared++;
        y++; // Re-check the same line index
      }
    }
    return linesCleared;
  }

  getGhostY(piece: Piece): number {
    let offsetY = 0;
    while (this.isValidMove(piece, 0, offsetY + 1)) {
      offsetY++;
    }
    return piece.y + offsetY;
  }
}
