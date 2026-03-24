import './style.css';
import { GameLogic } from './engine/GameLogic';
import { InputHandler } from './engine/InputHandler';
import { Renderer } from './ui/Renderer';
import { DEFAULT_KEYS, COLORS } from './constants';
import type { KeyAction } from './constants';

import { io, Socket } from 'socket.io-client';

class App {
  game: GameLogic;
  renderer: Renderer;
  input: InputHandler;
  
  // Networking
  socket: Socket | null = null;
  username = '';
  roomCode = '';
  opponents: Map<string, { username: string, board: any, alive: boolean }> = new Map();

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
      (action) => this.handleAction(action)
    );

    this.initLobby();
    this.initSettings();
    this.startLoop();
  }

  initLobby() {
    const joinBtn = document.getElementById('join-btn')!;
    const startBtn = document.getElementById('start-game-btn')!;
    const usernameInput = document.getElementById('username-input') as HTMLInputElement;
    const roomInput = document.getElementById('room-input') as HTMLInputElement;
    const roomLobby = document.getElementById('room-lobby')!;

    joinBtn.onclick = () => {
        this.username = usernameInput.value || `Player${Math.floor(Math.random()*1000)}`;
        this.roomCode = roomInput.value || '1234';
        
        this.socket = io('http://localhost:3001');
        this.setupSocketListeners();
        this.socket.emit('joinRoom', { username: this.username, roomCode: this.roomCode });
        
        document.querySelector('.lobby-inputs')!.classList.add('hidden');
        roomLobby.classList.remove('hidden');
        document.getElementById('display-room-code')!.textContent = this.roomCode;
    };

    startBtn.onclick = () => {
        if (this.socket) this.socket.emit('startGame', this.roomCode);
    };

    document.getElementById('back-to-lobby')!.onclick = () => {
        document.getElementById('results-modal')!.classList.add('hidden');
        document.getElementById('lobby')!.classList.remove('hidden');
        document.querySelector('.game-container')!.classList.add('hidden');
        document.querySelector('.lobby-inputs')!.classList.remove('hidden');
        roomLobby.classList.add('hidden');
    };
  }

  setupSocketListeners() {
      if (!this.socket) return;

      this.socket.on('roomUpdate', (players: any[]) => {
          const playerList = document.getElementById('player-list')!;
          playerList.innerHTML = '';
          players.forEach((p: any) => {
              const div = document.createElement('div');
              div.className = 'player-bubble';
              div.textContent = p.username;
              playerList.appendChild(div);

              if (this.socket && p.id !== this.socket.id) {
                  const existing = this.opponents.get(p.id) || { board: null, alive: true, username: '' };
                  this.opponents.set(p.id, { ...existing, username: p.username, alive: p.alive });
              }
          });
          
          if (players.length > 0 && players[0].id === this.socket?.id) {
              document.getElementById('start-game-btn')!.classList.remove('hidden');
          }
      });

      this.socket.on('gameStart', () => {
          document.getElementById('lobby')!.classList.add('hidden');
          document.querySelector('.game-container')!.classList.remove('hidden');
          this.opponents.forEach(op => op.alive = true);
          this.resetGame();
      });

      this.socket.on('opponentBoardUpdate', ({ id, board }) => {
          const op = this.opponents.get(id);
          if (op) {
              op.board = board;
              op.alive = true;
          }
          this.updateOpponentBoardsUI();
      });

      this.socket.on('receiveGarbage', ({ amount }) => {
          console.log('Received garbage:', amount);
          this.game.receiveGarbage(amount);
      });

      this.socket.on('playerKO', ({ id, rank }) => {
          const op = this.opponents.get(id);
          if (op) op.alive = false;
          if (id === this.socket?.id) {
              this.game.isGameOver = true;
              this.showGameOver(rank);
          }
      });

      this.socket.on('gameEnd', ({ winner }) => {
          this.showResults(winner);
      });
  }

  showGameOver(rank: number) {
      const title = document.getElementById('results-title')!;
      title.textContent = `FINISHED #${rank}`;
      document.getElementById('results-modal')!.classList.remove('hidden');
  }

  showResults(winner: string) {
      const title = document.getElementById('results-title')!;
      title.textContent = `WINNER: ${winner}`;
      document.getElementById('results-modal')!.classList.remove('hidden');
  }

  updateOpponentBoardsUI() {
      let grid = document.getElementById('opponent-boards');
      if (!grid) {
          grid = document.createElement('div');
          grid.id = 'opponent-boards';
          grid.className = 'opponent-boards';
          document.querySelector('.game-container')!.appendChild(grid);
      }

      this.opponents.forEach((op, id) => {
          let el = document.getElementById(`op-${id}`);
          if (!el) {
              el = document.createElement('div');
              el.id = `op-${id}`;
              el.className = 'opponent-item';
              el.innerHTML = `<canvas class="opponent-canvas" width="60" height="120"></canvas><div class="opponent-name">${op.username}</div>`;
              grid!.appendChild(el);
          }
          const canvas = el.querySelector('canvas')!;
          this.renderer.drawSmallBoard(canvas, op.board);
      });
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

      if (!this.isPaused && this.game.isAlive) {
        const dt = (time - this.lastFrameTime) / 1000;
        this.lastFrameTime = time;

        const dropDt = time - this.lastDropTime;
        if (dropDt > this.dropInterval) {
          if (!this.game.move(0, 1)) {
              // Wait for lock delay in updateLockDelay
          }
          this.lastDropTime = time;
        }
        
        const prevPiece = this.game.currentPiece;
        this.game.updateLockDelay();
        this.game.tick(dt);
        
        if (this.game.currentPiece !== prevPiece) {
            this.onPieceLock();
        }
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
    
    const pendingEl = document.getElementById('pending-garbage');
    if (pendingEl) {
        pendingEl.textContent = this.game.pendingGarbage.toString();
        if (this.game.pendingGarbage > 0) {
            pendingEl.parentElement!.classList.add('warning-pulse');
        } else {
            pendingEl.parentElement!.classList.remove('warning-pulse');
        }
    }
  }

  resetGame() {
      const mode = this.game.mode;
      this.game = new GameLogic();
      this.game.mode = mode;
      this.game.isAlive = true;
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
      
      console.log('Piece locked. Attack calculated:', result.attack, 'Lines:', result.lines);

      // Process pending garbage FIRST so the updated board is broadcasted
      this.game.processGarbage();

      // Networking
      if (this.socket) {
          this.socket.emit('updateBoard', { 
              roomCode: this.roomCode, 
              board: this.game.board.grid 
          });
          
          if (result.attack > 0) {
              console.log('Sending garbage:', result.attack);
              this.socket.emit('sendGarbage', { 
                  roomCode: this.roomCode, 
                  amount: result.attack 
              });
          }
      }

      if (this.game.isGameOver) {
          this.game.isAlive = false;
          if (this.socket) {
              this.socket.emit('gameOver', { roomCode: this.roomCode });
          }
      }

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
