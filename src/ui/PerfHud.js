// The performance counter (the user, 2026-11-23: a verification HUD for the graphics rework; P is pause,
// so it's the backquote key, `). Frames a second and their length, the time the GPU took when the
// browser can time it (EXT_disjoint_timer_query_webgl2), the game's update and the render's CPU time;
// draw calls and triangles for the whole frame with the shadow pass's share; the lights in the scene,
// the shader programs and the buffers' sizes. It counts across every render of a frame (the composer's
// passes and the shadow map), so `renderer.info` is reset by hand while it's up. `localStorage.gl_perf
// = '1'` opens it at boot. (What each object costs: tools/perf-probe.js.)
import { Vector2 } from 'three';

const M = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 1e4 ? `${Math.round(n / 1e3)} k` : String(n));

export class PerfHud {
  constructor(engine) {
    this.engine = engine;
    this.el = document.createElement('div');
    this.el.id = 'perf';
    document.body.appendChild(this.el);
    this.on = false;
    this.frames = 0;
    this.since = performance.now();
    this.ms = 1000 / 60;
    this.gpu = null;
    this.queries = [];
    this.shadow = { calls: 0, triangles: 0 };
    this.last = { calls: 0, triangles: 0, shadowCalls: 0, shadowTriangles: 0, lines: 0, points: 0 };
    addEventListener('keydown', (e) => { if (e.code === 'Backquote' && !e.repeat) this.toggle(); });
    let open = false;
    try { open = localStorage.getItem('gl_perf') === '1'; } catch { /* storage blocked */ }
    if (open) this.toggle(true);
  }

  toggle(on = !this.on) {
    const { renderer } = this.engine, info = renderer.info;
    this.on = on;
    this.el.classList.toggle('show', on);
    info.autoReset = !on;
    info.reset();
    this.engine.perf = on ? this : null;
    if (on && !this.wrapped) {
      // the shadow pass's share: what the shadow map draws inside each render
      const sm = renderer.shadowMap, render = sm.render.bind(sm);
      sm.render = (...args) => {
        const c = info.render.calls, t = info.render.triangles;
        render(...args);
        this.shadow.calls += info.render.calls - c;
        this.shadow.triangles += info.render.triangles - t;
      };
      const gl = renderer.getContext();
      this.gl = gl;
      this.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      this.wrapped = true;
    }
    if (on) { this.frames = 0; this.since = performance.now(); this.draw(); }
  }

  // around each frame the engine draws (Engine.start)
  begin() {
    const { gl, timer } = this;
    if (!timer || this.active) return;
    const q = gl.createQuery();
    gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(stamp) {
    const { gl, timer, engine } = this, info = engine.renderer.info;
    if (this.active) { gl.endQuery(timer.TIME_ELAPSED_EXT); this.queries.push(this.active); this.active = null; }
    // the GPU's answers come a frame or two late
    while (this.queries.length) {
      const q = this.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getParameter(timer.GPU_DISJOINT_EXT) ? null : gl.getQueryParameter(q, gl.QUERY_RESULT);
      if (ns != null) this.gpu = this.gpu == null ? ns / 1e6 : this.gpu + (ns / 1e6 - this.gpu) * 0.1;
      gl.deleteQuery(q);
      this.queries.shift();
    }
    if (this.queries.length > 8) { for (const q of this.queries) gl.deleteQuery(q); this.queries.length = 0; }
    if (this.stamp != null) this.ms += (stamp - this.stamp - this.ms) * 0.1;
    this.stamp = stamp;
    const r = info.render;
    if (r.calls > 0) {
      Object.assign(this.last, { calls: r.calls, triangles: r.triangles, lines: r.lines, points: r.points, shadowCalls: this.shadow.calls, shadowTriangles: this.shadow.triangles });
    }
    info.reset();
    this.shadow.calls = this.shadow.triangles = 0;
    this.frames++;
    const now = performance.now();
    if (now - this.since > 500) { this.fps = (this.frames * 1000) / (now - this.since); this.frames = 0; this.since = now; this.draw(); }
  }

  // the lights the scene's shaders are compiled for (every visible one costs every lit pixel)
  lights() {
    const n = { point: 0, spot: 0, sun: 0, shadows: 0 };
    this.engine.scene.traverseVisible((o) => {
      if (!o.isLight) return;
      if (o.isPointLight) n.point++;
      else if (o.isSpotLight) n.spot++;
      else if (o.isDirectionalLight) n.sun++;
      if (o.castShadow && !o.isAmbientLight && !o.isHemisphereLight) n.shadows++;
    });
    return n;
  }

  draw() {
    const { engine, last } = this, { renderer } = engine, info = renderer.info;
    const c = engine.cpu ?? { update: 0, render: 0 };
    const L = this.lights();
    const buf = renderer.getDrawingBufferSize(this._v ??= new Vector2());
    const rt = engine.renderPass.target, bloom = engine.bloom.renderTargetBright;
    const row = (k, v) => `<div><b>${k}</b>${v}</div>`;
    this.el.innerHTML = [
      row('fps', `${Math.round(this.fps ?? 0)} &nbsp; ${this.ms.toFixed(1)} ms`),
      row('gpu', this.timer ? (this.gpu == null ? '…' : `${this.gpu.toFixed(1)} ms`) : 'not timed here'),
      row('cpu', engine.paused ? 'paused (the frame drawn again)' : `update ${c.update.toFixed(1)} · draw ${c.render.toFixed(1)} ms`),
      row('calls', `${last.calls} &nbsp; <i>shadow ${last.shadowCalls}</i>`),
      row('tris', `${M(last.triangles)} &nbsp; <i>shadow ${M(last.shadowTriangles)}</i>`),
      row('lights', `${L.point} point · ${L.spot} spot · ${L.sun} sun · ${L.shadows} shadowed`),
      row('gpu mem', `${info.programs?.length ?? 0} programs · ${info.memory.geometries} geometries · ${info.memory.textures} textures`),
      row('res', `${buf.x}×${buf.y} ×${engine.ratio.toFixed(3).replace(/\.?0+$/, '')}${engine.fixedRatio ? ' fixed' : ''} · scene ${rt.width}×${rt.height} ${rt.samples}× msaa · bloom ${bloom.width}×${bloom.height}`),
    ].join('');
  }
}
