// Keyboard + mouse-look. Pointer lock is only requested while the player has control.
// Mouse buttons report as 'Mouse0' (left) and 'Mouse2' (right) besides the generic 'Click'.
export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.taps = new Map(); // code -> time of the previous press, for double taps
    this.doubled = new Set();
    this.look = { dx: 0, dy: 0 };
    this.mouse = { dx: 0, dy: 0, x: innerWidth / 2, y: innerHeight / 2 }; // raw, whether or not looking is enabled
    this.wheel = 0;
    this.locked = false;
    this.lookEnabled = false;
    this.dragging = false;

    const press = (code) => {
      const now = performance.now(), last = this.taps.get(code) ?? -1e9;
      if (now - last < 300) { this.doubled.add(code); this.taps.set(code, -1e9); } else this.taps.set(code, now);
      this.pressed.add(code);
      this.keys.add(code);
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      press(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mousedown', (e) => {
      this.pressed.add('Click');
      press(`Mouse${e.button}`);
      if (!this.lookEnabled) return;
      if (dom.requestPointerLock && !this.locked) dom.requestPointerLock()?.catch?.(() => {});
      this.dragging = true;
    });
    window.addEventListener('mouseup', (e) => {
      this.dragging = false;
      this.keys.delete(`Mouse${e.button}`);
      this.released.add(`Mouse${e.button}`);
    });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    this.onLockLost = null; // the player pressed Esc to release the mouse (the game pauses)
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === dom;
      if (was && !this.locked && this.lookEnabled && !this.releasing) this.onLockLost?.();
      this.releasing = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (this.lookEnabled && (this.locked || this.dragging)) {
        this.look.dx += e.movementX;
        this.look.dy += e.movementY;
      }
    });
  }

  down(code) { return this.keys.has(code); }
  hit(...codes) { return codes.some((c) => this.pressed.has(c)); }
  up(...codes) { return codes.some((c) => this.released.has(c)); }
  // Two presses of the same key within 300 ms (the second press reports it).
  doubleTap(code) { return this.doubled.has(code); }
  // Swallow this frame's presses (so one click doesn't act twice).
  consume(...codes) { for (const c of codes) { this.pressed.delete(c); this.doubled.delete(c); } }

  moveAxis() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const z = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    return { x, z };
  }

  setLook(enabled) {
    this.lookEnabled = enabled;
    if (!enabled && this.locked) { this.releasing = true; document.exitPointerLock(); }
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.doubled.clear();
    this.look.dx = 0;
    this.look.dy = 0;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.wheel = 0;
  }
}
