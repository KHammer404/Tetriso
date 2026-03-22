import './style.css';
import { GameLogic } from './engine/GameLogic';
import { InputHandler } from './engine/InputHandler';
import { Renderer } from './ui/Renderer';
import { DEFAULT_KEYS, COLORS } from './constants';
import type { KeyAction, PieceType } from './constants';

class App {
  game: GameLogic;
  renderer: Renderer;
  input: InputHandler;
  
  lastDropTime = 0;
  lastFrameTime = 0;
  dropInterval = 1000;
  isPaused = false;

  keyBindings: Record<KeyAction, string>;
  waitingForAction: KeyAction | null = null;

  constructor() {
    this.keyBindings = this.loadKeyBindings();
    this.game = new GameLogic();
    
    const canvas = document.getElementById('game-board') as HTMLCanvasElement;
    const holdCanvas = document.getElementById('hold-piece') as HTMLCanvasElement;
    const nextCanvas = document.getElementById('next-queue') as HTMLCanvasElement;
    
    canvas.width = 300;
    canvas.height = 600;
    holdCanvas.width = 100;
    holdCanvas.height = 100;
    nextCanvas.width = 100;
    nextCanvas.height = 500;

    this.renderer = new Renderer(canvas, holdCanvas, nextCanvas);
    
    this.input = new InputHandler(
      this.keyBindings,
      (action) => this.handleAction(action),
      (action) => this.handleAction(action) // OnHold also calls handleAction
    );

    this.initSettings();
    this.startLoop();
  }

  loadKeyBindings(): Record<KeyAction, string> {
    const saved = localStorage.getItem('tetris-keys');
    if (saved) {
      try {
        return { ...DEFAULT_KEYS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_KEYS;
      }
    }
    return DEFAULT_KEYS;
  }

  saveKeyBindings() {
    localStorage.setItem('tetris-keys', JSON.stringify(this.keyBindings));
  }

  initSettings() {
    const settingsBtn = document.getElementById('settings-btn')!;
    const modal = document.getElementById('settings-modal')!;
    const closeBtn = document.getElementById('close-settings')!;
    
    // Handling sliders
    const dasRange = document.getElementById('das-range') as HTMLInputElement;
    const arrRange = document.getElementById('arr-range') as HTMLInputElement;
    const dasVal = document.getElementById('das-val')!;
    const arrVal = document.getElementById('arr-val')!;

    dasRange.oninput = () => {
        dasVal.textContent = dasRange.value;
        this.input.das = parseInt(dasRange.value);
        localStorage.setItem('tetris-das', dasRange.value);
    };
    arrRange.oninput = () => {
        arrVal.textContent = arrRange.value;
        this.input.arr = parseInt(arrRange.value);
        localStorage.setItem('tetris-arr', arrRange.value);
    };

    // Load handling defaults
    const savedDas = localStorage.getItem('tetris-das') || '160';
    const savedArr = localStorage.getItem('tetris-arr') || '20';
    dasRange.value = savedDas;
    arrRange.value = savedArr;
    dasVal.textContent = savedDas;
    arrVal.textContent = savedArr;
    this.input.das = parseInt(savedDas);
    this.input.arr = parseInt(savedArr);

    // Mode Selection
    ['marathon', 'sprint', 'blitz'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`)!;
        btn.onclick = () => {
            document.querySelectorAll('.mode-buttons .primary-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.game.mode = m as any;
            this.resetGame();
        };
    });

    settingsBtn.onclick = () => {
      this.isPaused = true;
      modal.classList.remove('hidden');
      this.renderBindings();
    };

    closeBtn.onclick = () => {
      this.isPaused = false;
      modal.classList.add('hidden');
      this.waitingForAction = null;
    };

    window.addEventListener('keydown', (e) => {
      if (this.waitingForAction) {
        e.preventDefault();
        this.keyBindings[this.waitingForAction] = e.code;
        this.input.updateMapping(this.keyBindings);
        this.saveKeyBindings();
        this.waitingForAction = null;
        this.renderBindings();
      }
    });
  }

  renderBindings() {
    const list = document.getElementById('key-bindings-list')!;
    list.innerHTML = '';

    Object.entries(this.keyBindings).forEach(([action, key]) => {
      const item = document.createElement('div');
      item.className = 'binding-item';
      
      const label = document.createElement('span');
      label.className = 'binding-label';
      label.textContent = action.replace(/([A-Z])/g, ' $1');
      
      const btn = document.createElement('button');
      btn.className = 'key-btn' + (this.waitingForAction === action ? ' waiting' : '');
      btn.textContent = this.waitingForAction === action ? 'PRESS KEY...' : key.replace('Arrow', '').replace('Key', '');
      
      btn.onclick = () => {
        this.waitingForAction = action as KeyAction;
        this.renderBindings();
      };

      item.appendChild(label);
      item.appendChild(btn);
      list.appendChild(item);
    });
  }

  handleAction(action: KeyAction) {
    if (this.game.isGameOver || this.isPaused) return;
    this.initAudio();

    switch (action) {
      case 'moveLeft': 
      case 'moveRight': 
        if (this.game.move(action === 'moveLeft' ? -1 : 1, 0)) {
            this.playSound(300, 0.05, 'sine', 0.05);
        }
        break;
      case 'rotateCW':
      case 'rotateCCW':
      case 'rotate180':
        if (this.game.rotate(action === 'rotateCW' ? 'CW' : action === 'rotateCCW' ? 'CCW' : '180')) {
            this.playSound(400, 0.1, 'sine', 0.05);
        }
        break;
      case 'hardDrop': 
        this.game.hardDrop(); 
        this.onPieceLock();
        break;
      case 'hold': 
        this.game.hold();
        this.playSound(600, 0.1, 'sine', 0.05);
        break;
      case 'softDrop': this.game.move(0, 1); break;
    }
  }

  startLoop() {
    const loop = (time = 0) => {
      if (this.game.isGameOver) {
        alert('Game Over! Score: ' + this.game.score);
        return;
      }

      if (!this.isPaused) {
        const dt = (time - this.lastFrameTime) / 1000;
        this.lastFrameTime = time;

        const dropDt = time - this.lastDropTime;
        if (dropDt > this.dropInterval) {
          if (!this.game.move(0, 1)) {
              // Wait for lock delay in updateLockDelay
          }
          this.lastDropTime = time;
        }
        
        const wasGrounded = this.game.isGrounded();
        const prevPiece = this.game.currentPiece;
        this.game.updateLockDelay();
        this.game.tick(dt);
        
        if (this.game.currentPiece !== prevPiece) {
            this.onPieceLock();
        }
        if (wasGrounded && !this.game.isGrounded()) {
            // Un-grounded by move/rotate
        } else if (!wasGrounded && this.game.isGrounded()) {
            // Just touched ground
        }
        
        // Check if piece locked (currentPiece changed)
        // We can track this more reliably by checking a flag or comparing types
        // For now, let's simplify and call a hook in GameLogic or check here
        
        this.input.update();
        
        const ghostY = this.game.board.getGhostY(this.game.currentPiece);
        this.renderer.draw(this.game.board, this.game.currentPiece, ghostY, dt);
        this.renderer.drawHold(this.game.holdPiece);
        this.renderer.drawNext(this.game.nextQueue);
      }
      
      this.updateStats();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateStats() {
    document.getElementById('score')!.textContent = this.game.score.toString();
    document.getElementById('lines')!.textContent = this.game.lines.toString();
    document.getElementById('level')!.textContent = this.game.level.toString();
  }

  resetGame() {
      const mode = this.game.mode;
      this.game = new GameLogic();
      this.game.mode = mode;
      this.lastDropTime = performance.now();
      this.lastFrameTime = performance.now();
      this.isPaused = false;
      this.updateStats();
      this.playSound(440, 0.1, 'square'); // Reset sound
  }

  // Audio System
  private audioCtx: AudioContext | null = null;
  private initAudio() {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
  }

  private playSound(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.1) {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      
      gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + dur);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + dur);
  }

  // Hook for handling effects when a piece locks
  onPieceLock() {
      const result = this.game.lastResult;
      this.initAudio();
      
      const pieceColor = COLORS[result.pieceType];
      
      // Sound
      if (result.spin !== 'none') {
          // Unique Spin Sound (Higher pitch sequence)
          this.playSound(880, 0.2, 'triangle', 0.2); // A5
          setTimeout(() => this.playSound(1320, 0.2, 'triangle', 0.1), 50); // E6
          
          const lineLabels = ['', ' SINGLE', ' DOUBLE', ' TRIPLE'];
          const spinLabel = `${result.pieceType}-SPIN${lineLabels[result.lines] || ''}`;
          this.renderer.addFloatingText(150, 300, spinLabel, pieceColor);
      } else if (result.lines > 0) {
          this.playSound(523.25, 0.3, 'triangle', 0.2); // C5
          if (result.lines >= 4) this.playSound(659.25, 0.5, 'triangle', 0.2); // E5
      } else {
          this.playSound(220, 0.1, 'square', 0.05); // A3
      }

      // Screen Shake
      if (result.lines >= 4 || result.spin !== 'none') {
          this.renderer.shake(15, 0.2);
      } else if (result.lines > 0) {
          this.renderer.shake(5, 0.1);
      } else {
          this.renderer.shake(2, 0.05);
      }

      // Particles on line clear
      if (result.lines > 0) {
          this.renderer.particles.emit(150, 400, result.spin !== 'none' ? pieceColor : '#ffffff', result.lines * 20);
      }
  }
}

window.addEventListener('DOMContentLoaded', () => {
    new App();
});
