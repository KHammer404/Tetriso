import { SHAPES, SRS_KICKS, SRS_KICKS_I } from '../constants';
import type { PieceType } from '../constants';

export class Piece {
  type: PieceType;
  x: number;
  y: number;
  rotation: number; // 0, 1, 2, 3
  shape: number[][];

  constructor(type: PieceType, x: number, y: number) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.shape = SHAPES[type];
  }

  getBlocks() {
    return this.shape;
  }

  rotateCW() {
    const nextRotation = (this.rotation + 1) % 4;
    const nextShape = this.getRotatedShape(nextRotation);
    return { nextRotation, nextShape };
  }

  rotateCCW() {
    const nextRotation = (this.rotation + 3) % 4;
    const nextShape = this.getRotatedShape(nextRotation);
    return { nextRotation, nextShape };
  }

  rotate180() {
    const nextRotation = (this.rotation + 2) % 4;
    const nextShape = this.getRotatedShape(nextRotation);
    return { nextRotation, nextShape };
  }

  private getRotatedShape(targetRotation: number): number[][] {
    // For simplicity, we can pre-calculate or rotate the initial shape
    // Modern Tetris shapes are typically defined in a bounding box (3x3 or 4x4)
    let currentShape = SHAPES[this.type];
    for (let i = 0; i < targetRotation; i++) {
      currentShape = this.rotateMatrixCW(currentShape);
    }
    return currentShape;
  }

  private rotateMatrixCW(matrix: number[][]): number[][] {
    const size = matrix.length;
    let newMatrix = Array.from({ length: size }, () => Array(size).fill(0));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        newMatrix[x][size - 1 - y] = matrix[y][x];
      }
    }
    return newMatrix;
  }

  getKickData(prevRotation: number, nextRotation: number): [number, number][] {
    const key = `${prevRotation}->${nextRotation}`;
    if (this.type === 'O') return [[0, 0]];
    if (this.type === 'I') return SRS_KICKS_I[key] || [[0, 0]];
    return SRS_KICKS[key] || [[0, 0]];
  }

  copy(): Piece {
    const p = new Piece(this.type, this.x, this.y);
    p.rotation = this.rotation;
    p.shape = JSON.parse(JSON.stringify(this.shape));
    return p;
  }
}
