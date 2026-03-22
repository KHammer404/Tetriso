import type { KeyAction } from '../constants';

export class InputHandler {
  private keys: Record<string, boolean> = {};
  private dasTimers: Record<string, number> = {};
  private arrTimers: Record<string, number> = {};
  
  private keyMap: Record<string, KeyAction> = {};
  
  onPress: (action: KeyAction) => void;
  onHold: (action: KeyAction) => void;

  public das = 160;
  public arr = 20;

  constructor(
    initialMapping: Record<KeyAction, string>,
    onPress: (action: KeyAction) => void, 
    onHold: (action: KeyAction) => void
  ) {
    this.onPress = onPress;
    this.onHold = onHold;
    this.updateMapping(initialMapping);
    
    window.addEventListener('keydown', (e) => {
      const action = this.keyMap[e.code];
      if (action && !this.keys[e.code]) {
        this.keys[e.code] = true;
        this.onPress(action);
        this.dasTimers[e.code] = performance.now();
        this.arrTimers[e.code] = 0;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      delete this.dasTimers[e.code];
      delete this.arrTimers[e.code];
    });
  }

  updateMapping(mapping: Record<KeyAction, string>) {
    this.keyMap = {};
    for (const [action, key] of Object.entries(mapping)) {
      this.keyMap[key] = action as KeyAction;
    }
  }

  update() {
    const now = performance.now();
    for (const keyCode in this.keys) {
      if (!this.keys[keyCode]) continue;
      
      const action = this.keyMap[keyCode];
      if (!action) continue;

      // Handle DAS/ARR for Left/Right
      if (action === 'moveLeft' || action === 'moveRight') {
        const elapsed = now - this.dasTimers[keyCode];
        if (elapsed >= this.das) {
            if (this.arr === 0) {
                this.onHold(action);
            } else {
                if (now - this.arrTimers[keyCode] >= this.arr) {
                    this.onHold(action);
                    this.arrTimers[keyCode] = now;
                }
            }
        }
      }
      
      // Handle Soft Drop
      if (action === 'softDrop') {
          this.onHold(action);
      }
    }
  }
}
