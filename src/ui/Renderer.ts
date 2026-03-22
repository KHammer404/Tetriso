import { Board } from '../engine/Board';
import { Piece } from '../engine/Piece';
import { GAME_CONFIG, COLORS, SHAPES } from '../constants';
import type { PieceType } from '../constants';
import { ParticleSystem } from './ParticleSystem';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  holdCtx: CanvasRenderingContext2D;
  nextCtx: CanvasRenderingContext2D;
  
  blockSize: number;
  particles: ParticleSystem;
  
  private floatingTexts: { x: number, y: number, text: string, life: number, color: string }[] = [];
  
  shakeAmount = 0;
  shakeDuration = 0;

  constructor(
    canvas: HTMLCanvasElement,
    holdCanvas: HTMLCanvasElement,
    nextCanvas: HTMLCanvasElement
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.holdCtx = holdCanvas.getContext('2d')!;
    this.nextCtx = nextCanvas.getContext('2d')!;
    
    this.blockSize = canvas.width / GAME_CONFIG.BOARD_WIDTH;
    this.particles = new ParticleSystem();
  }

  shake(amount: number, duration: number) {
    this.shakeAmount = amount;
    this.shakeDuration = duration;
  }

  draw(board: Board, currentPiece: Piece, ghostY: number, dt: number) {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    
    this.ctx.save();
    
    // Apply Shake
    if (this.shakeDuration > 0) {
        const sx = (Math.random() - 0.5) * this.shakeAmount;
        const sy = (Math.random() - 0.5) * this.shakeAmount;
        this.ctx.translate(sx, sy);
        this.shakeDuration -= dt;
    }
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= board.width; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.blockSize, 0);
      this.ctx.lineTo(x * this.blockSize, board.height * this.blockSize);
      this.ctx.stroke();
    }
    for (let y = 0; y <= board.height; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.blockSize);
      this.ctx.lineTo(board.width * this.blockSize, y * this.blockSize);
      this.ctx.stroke();
    }

    // Draw Locked Blocks
    for (let y = GAME_CONFIG.BUFFER_HEIGHT; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.grid[y][x];
        if (cell) {
          this.drawBlock(this.ctx, x, y - GAME_CONFIG.BUFFER_HEIGHT, COLORS[cell]);
        }
      }
    }

    // Draw Ghost Piece
    this.drawPiece(this.ctx, currentPiece, ghostY - GAME_CONFIG.BUFFER_HEIGHT, true);

    // Draw Current Piece
    this.drawPiece(this.ctx, currentPiece, currentPiece.y - GAME_CONFIG.BUFFER_HEIGHT, false);

    this.ctx.restore();

    // Update and Draw Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= 1; // Float up
        ft.life -= dt / 1000; // life is in seconds-ish
        if (ft.life <= 0) {
            this.floatingTexts.splice(i, 1);
            continue;
        }
        this.ctx.fillStyle = ft.color;
        this.ctx.globalAlpha = ft.life;
        this.ctx.font = 'bold 20px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(ft.text, ft.x, ft.y);
        this.ctx.globalAlpha = 1.0;
    }

    this.particles.update(dt);
    this.particles.draw(this.ctx);
  }

  addFloatingText(x: number, y: number, text: string, color: string) {
      this.floatingTexts.push({ x, y, text, life: 1.0, color });
  }

  drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, yOffset: number, isGhost: boolean) {
    const shape = piece.getBlocks();
    const color = isGhost ? COLORS.G : COLORS[piece.type];
    const opacity = isGhost ? GAME_CONFIG.GHOST_OPACITY : 1;

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          this.drawBlock(ctx, piece.x + x, yOffset + y, color, opacity);
        }
      }
    }
  }

  drawHold(pieceType: PieceType | null) {
    this.holdCtx.clearRect(0, 0, this.holdCtx.canvas.width, this.holdCtx.canvas.height);
    if (!pieceType) return;
    this.drawMinimap(this.holdCtx, pieceType);
  }

  drawNext(queue: PieceType[]) {
    this.nextCtx.clearRect(0, 0, this.nextCtx.canvas.width, this.nextCtx.canvas.height);
    queue.forEach((type, i) => {
        this.drawMinimap(this.nextCtx, type, i * 3.5);
    });
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, type: PieceType, yOffset = 0) {
    // Piece definitions are usually 3x3 or 4x4
    const shape = SHAPES[type]; 
    const size = 18; // Smaller block size for minimap
    const color = COLORS[type];
    
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          this.drawBlockRaw(ctx, x * size + 10, (y + yOffset) * size + 20, size, color);
        }
      }
    }
  }

  private drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, opacity = 1) {
    this.drawBlockRaw(ctx, x * this.blockSize, y * this.blockSize, this.blockSize, color, opacity);
  }

  private drawBlockRaw(ctx: CanvasRenderingContext2D, px: number, py: number, size: number, color: string, opacity = 1) {
    ctx.globalAlpha = opacity;
    
    // Gradient fill for premium look
    const grad = ctx.createLinearGradient(px, py, px + size, py + size);
    grad.addColorStop(0, color);
    grad.addColorStop(1, this.shadeColor(color, -30));
    
    ctx.fillStyle = grad;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    
    // Subtle border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
    
    ctx.globalAlpha = 1.0;
  }

  private shadeColor(color: string, percent: number) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.floor((R * (100 + percent)) / 100);
    G = Math.floor((G * (100 + percent)) / 100);
    B = Math.floor((B * (100 + percent)) / 100);

    R = R < 255 ? R : 255;
    G = G < 255 ? G : 255;
    B = B < 255 ? B : 255;

    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return '#' + RR + GG + BB;
  }
}
