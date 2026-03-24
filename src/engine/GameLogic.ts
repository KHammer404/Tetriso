import { Board } from './Board';
import { Piece } from './Piece';
import { GAME_CONFIG } from '../constants';
import type { PieceType } from '../constants';

export type GameMode = 'marathon' | 'sprint' | 'blitz';

export class GameLogic {
  board: Board;
  currentPiece: Piece;
  holdPiece: PieceType | null = null;
  holdUsed = false;
  nextQueue: PieceType[] = [];
  bag: PieceType[] = [];
  
  mode: GameMode = 'marathon';
  timer = 0;
  startTime = 0;
  
  score = 0;
  lines = 0;
  level = 1;
  
  isGameOver = false;

  // Advanced Logic state
  comboCount = -1; // Starts at -1, first clear makes it 0
  b2bActive = false;
  lastActionWasRotate = false;
  spinStatus: 'none' | 'mini' | 'normal' = 'none';
  
  // Multiplayer state
  isAlive = true;
  garbageQueue: number[] = [];
  pendingGarbage = 0;

  lastResult: { 
    lines: number, 
    spin: 'none' | 'mini' | 'normal',
    pieceType: PieceType,
    attack: number
  } = { lines: 0, spin: 'none', pieceType: 'T', attack: 0 };

  // Lock Delay state
  lockDelayActive = false;
  lockDelayStartTime = 0;
  lockResets = 0;

  constructor() {
    this.board = new Board();
    this.refillBag();
    this.refillNextQueue();
    this.currentPiece = this.spawnPiece();
  }

  private refillBag() {
    const pieces: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    this.bag.push(...pieces);
  }

  private refillNextQueue() {
    while (this.nextQueue.length < 5) {
      if (this.bag.length === 0) this.refillBag();
      this.nextQueue.push(this.bag.shift()!);
    }
  }

  spawnPiece(type?: PieceType): Piece {
    const t = type || this.nextQueue.shift()!;
    this.refillNextQueue();
    
    let spawnX = 3;
    let spawnY = GAME_CONFIG.BUFFER_HEIGHT - 2;
    
    const p = new Piece(t, spawnX, spawnY);
    if (!this.board.isValidMove(p)) {
      this.isGameOver = true;
    }

    this.lockDelayActive = false;
    this.lockResets = 0;
    this.lastActionWasRotate = false;
    this.spinStatus = 'none';
    
    return p;
  }

  tick(dt: number) {
    if (this.isGameOver) return;
    this.timer += dt;
    if (this.mode === 'blitz' && this.timer >= 120) {
        this.isGameOver = true;
    }
  }

  hold() {
    if (this.holdUsed) return;
    
    const currentType = this.currentPiece.type;
    if (this.holdPiece === null) {
      this.holdPiece = currentType;
      this.currentPiece = this.spawnPiece();
    } else {
      const prevHold = this.holdPiece;
      this.holdPiece = currentType;
      this.currentPiece = this.spawnPiece(prevHold);
    }
    this.holdUsed = true;
  }

  rotate(dir: 'CW' | 'CCW' | '180') {
    let result;
    const prevRotation = this.currentPiece.rotation;
    
    if (dir === 'CW') result = this.currentPiece.rotateCW();
    else if (dir === 'CCW') result = this.currentPiece.rotateCCW();
    else result = this.currentPiece.rotate180();

    const kicks = this.currentPiece.getKickData(prevRotation, result.nextRotation);
    
    for (const [kx, ky] of kicks) {
      if (this.board.isValidMove(this.currentPiece, kx, ky * -1, result.nextShape)) {
        this.currentPiece.x += kx;
        this.currentPiece.y -= ky;
        this.currentPiece.rotation = result.nextRotation;
        this.currentPiece.shape = result.nextShape;

        this.lastActionWasRotate = true;
        this.handleMoveRotateSuccess();
        return true;
      }
    }
    return false;
  }

  move(dx: number, dy: number): boolean {
    if (this.board.isValidMove(this.currentPiece, dx, dy)) {
      this.currentPiece.x += dx;
      this.currentPiece.y += dy;

      if (dx !== 0 || dy !== 0) {
        this.lastActionWasRotate = false;
        this.handleMoveRotateSuccess();
      }
      return true;
    }
    return false;
  }

  private handleMoveRotateSuccess() {
    if (this.isGrounded()) {
      if (this.lockResets < GAME_CONFIG.MAX_LOCK_RESETS) {
        this.lockResets++;
        this.lockDelayStartTime = performance.now();
      }
    }
  }

  isGrounded(): boolean {
    return !this.board.isValidMove(this.currentPiece, 0, 1);
  }

  updateLockDelay() {
    const now = performance.now();
    if (this.isGrounded()) {
      if (!this.lockDelayActive) {
        this.lockDelayActive = true;
        this.lockDelayStartTime = now;
      } else {
        if (now - this.lockDelayStartTime >= GAME_CONFIG.LOCK_DELAY) {
          this.lock();
        }
      }
    } else {
      this.lockDelayActive = false;
    }
  }

  private checkSpin(): 'none' | 'mini' | 'normal' {
    if (!this.lastActionWasRotate) return 'none';

    // Immobile rule: cannot move in any of 4 directions
    const canMoveLeft = this.board.isValidMove(this.currentPiece, -1, 0);
    const canMoveRight = this.board.isValidMove(this.currentPiece, 1, 0);
    const canMoveUp = this.board.isValidMove(this.currentPiece, 0, -1);
    const canMoveDown = this.board.isValidMove(this.currentPiece, 0, 1);

    if (canMoveLeft || canMoveRight || canMoveUp || canMoveDown) {
        // Special case: Guideline T-Spin still uses 3-corner rule
        if (this.currentPiece.type === 'T') {
            const corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
            let filled = 0;
            for (const [cx, cy] of corners) {
                const bx = this.currentPiece.x + cx;
                const by = this.currentPiece.y + cy;
                if (bx < 0 || bx >= this.board.width || by >= this.board.height || (by >= 0 && this.board.grid[by][bx])) {
                    filled++;
                }
            }
            if (filled >= 3) return 'normal';
        }
        return 'none';
    }

    return 'normal'; 
  }

  hardDrop() {
    const dist = this.board.getGhostY(this.currentPiece) - this.currentPiece.y;
    this.currentPiece.y += dist;
    if (dist > 0) {
        this.lastActionWasRotate = false;
    }
    this.lock();
  }

  lock() {
    const pType = this.currentPiece.type;
    this.spinStatus = this.checkSpin();
    
    this.board.lockPiece(this.currentPiece);
    const cleared = this.board.clearLines();
    
    this.lastResult = { lines: cleared, spin: this.spinStatus, pieceType: pType, attack: 0 };
    this.updateScore(cleared);
    
    this.currentPiece = this.spawnPiece();
    this.holdUsed = false;
  }

  updateScore(lines: number) {
    if (lines === 0) {
      if (this.spinStatus === 'none') {
          this.comboCount = -1;
      }
      return;
    }

    this.comboCount++;
    this.lines += lines;
    if (this.mode === 'sprint' && this.lines >= 40) {
        this.isGameOver = true;
    }
    
    let baseScore = 0;
    let attack = 0;
    const isSpin = this.spinStatus !== 'none';
    const isTetris = lines === 4;

    if (isSpin) {
      if (lines === 1) { baseScore = 800; attack = 2; }
      else if (lines === 2) { baseScore = 1200; attack = 4; }
      else if (lines === 3) { baseScore = 1600; attack = 6; }
      else baseScore = 400; 
    } else {
      const multi = [0, 100, 300, 500, 800];
      const attackMulti = [0, 0, 1, 2, 4];
      baseScore = multi[lines];
      attack = attackMulti[lines];
    }

    if (isSpin || isTetris) {
      if (this.b2bActive) {
          baseScore *= 1.5;
          attack += 1;
      }
      this.b2bActive = true;
    } else {
      this.b2bActive = false;
    }

    // Combo attack
    if (this.comboCount > 0) {
        attack += Math.floor(this.comboCount / 2);
    }

    baseScore += this.comboCount * 50 * this.level;
    this.score += baseScore * this.level;
    this.level = Math.floor(this.lines / 10) + 1;
    
    // Counter garbage with attack
    while (this.pendingGarbage > 0 && attack > 0) {
        this.pendingGarbage--;
        attack--;
    }

    this.lastResult.attack = attack;
  }

  receiveGarbage(amount: number) {
      this.pendingGarbage += amount;
  }

  processGarbage() {
      if (this.pendingGarbage <= 0) return;
      this.board.addGarbage(this.pendingGarbage);
      this.pendingGarbage = 0;
  }
}
