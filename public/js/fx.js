// Hintergrund-Effekte auf einem <canvas>: Sterne, Schnee, Regen, Glühwürmchen, Netzwerk, Matrix, Herzen, Kirschblüten.
// startEffect() gibt eine Stopp-Funktion zurück.

const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

function hexToRgb(hex) {
  const h = /^#[0-9a-f]{6}$/i.test(hex ?? '') ? hex.slice(1) : 'a78bfa';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

function sprite(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.closePath();
}

const EFFECTS = {
  stars({ ctx, accent }) {
    let stars = [];
    let shooting = null;
    let nextShot = rand(120, 300);
    return {
      resize(w, h) {
        const n = Math.min(280, Math.round((w * h) / 5200));
        stars = Array.from({ length: n }, () => ({
          x: rand(0, w), y: rand(0, h), r: rand(0.3, 1.5), a: rand(0.35, 1), t: rand(0, Math.PI * 2),
          s: rand(0.01, 0.045), tint: Math.random() < 0.18,
        }));
      },
      step(dt, w, h) {
        for (const st of stars) {
          st.t += st.s * dt;
          const a = st.a * (0.55 + 0.45 * Math.sin(st.t));
          ctx.fillStyle = st.tint ? rgba(accent, a) : `rgba(255,255,255,${a})`;
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
        nextShot -= dt;
        if (!shooting && nextShot <= 0) {
          shooting = { x: rand(w * 0.1, w * 0.9), y: rand(0, h * 0.4), vx: rand(9, 14) * (Math.random() < 0.5 ? -1 : 1), vy: rand(3, 6), life: 1 };
          nextShot = rand(200, 520);
        }
        if (shooting) {
          const s = shooting;
          const tail = 14;
          const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * tail, s.y - s.vy * tail);
          g.addColorStop(0, `rgba(255,255,255,${s.life})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx * tail, s.y - s.vy * tail);
          ctx.stroke();
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.life -= 0.012 * dt;
          if (s.life <= 0 || s.y > h || s.x < -200 || s.x > w + 200) shooting = null;
        }
      },
    };
  },

  snow({ ctx }) {
    let flakes = [];
    const make = (w, h, top = false) => {
      const r = rand(0.8, 3.4);
      return { x: rand(0, w), y: top ? rand(-20, -4) : rand(0, h), r, vy: 0.25 + r * 0.32, t: rand(0, 6.28), a: rand(0.45, 0.95) };
    };
    return {
      resize(w, h) {
        const n = Math.min(240, Math.round((w * h) / 8000));
        flakes = Array.from({ length: n }, () => make(w, h));
      },
      step(dt, w, h) {
        ctx.fillStyle = '#fff';
        for (const f of flakes) {
          f.t += 0.012 * dt;
          f.y += f.vy * dt;
          f.x += Math.sin(f.t) * 0.45 * dt + 0.12 * dt;
          if (f.y > h + 6) Object.assign(f, make(w, h, true));
          if (f.x > w + 6) f.x = -6;
          ctx.globalAlpha = f.a;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    };
  },

  rain({ ctx, accent }) {
    let drops = [];
    const tint = rgba(accent.map((c) => Math.round(c * 0.35 + 190 * 0.65)), 1);
    const make = (w, h, top = false) => ({ x: rand(-50, w), y: top ? rand(-h * 0.3, -10) : rand(0, h), len: rand(10, 24), v: rand(10, 17), a: rand(0.12, 0.45) });
    return {
      resize(w, h) {
        const n = Math.min(320, Math.round((w * h) / 4800));
        drops = Array.from({ length: n }, () => make(w, h));
      },
      step(dt, w, h) {
        ctx.strokeStyle = tint;
        ctx.lineWidth = 1.1;
        for (const d of drops) {
          d.y += d.v * dt;
          d.x += d.v * 0.18 * dt;
          if (d.y > h + 30) Object.assign(d, make(w, h, true));
          ctx.globalAlpha = d.a;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * 0.18, d.y - d.len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    };
  },

  fireflies({ ctx, accent }) {
    let flies = [];
    const glow = sprite(64, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,240,1)');
      g.addColorStop(0.18, rgba(accent, 0.95));
      g.addColorStop(0.5, rgba(accent, 0.25));
      g.addColorStop(1, rgba(accent, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    return {
      resize(w, h) {
        const n = Math.min(70, Math.round((w * h) / 22000));
        flies = Array.from({ length: n }, () => ({ x: rand(0, w), y: rand(0, h), a: rand(0, 6.28), v: rand(0.2, 0.7), t: rand(0, 6.28), s: rand(14, 30) }));
      },
      step(dt, w, h) {
        for (const f of flies) {
          f.a += rand(-0.08, 0.08) * dt;
          f.x += Math.cos(f.a) * f.v * dt;
          f.y += Math.sin(f.a) * f.v * dt;
          f.t += 0.03 * dt;
          if (f.x < -30) f.x = w + 30;
          if (f.x > w + 30) f.x = -30;
          if (f.y < -30) f.y = h + 30;
          if (f.y > h + 30) f.y = -30;
          ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(f.t));
          ctx.drawImage(glow, f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
        }
        ctx.globalAlpha = 1;
      },
    };
  },

  particles({ ctx, accent }) {
    let pts = [];
    let mouse = null;
    const LINK = 135;
    return {
      resize(w, h) {
        const n = Math.min(95, Math.round((w * h) / 13000));
        pts = Array.from({ length: n }, () => ({ x: rand(0, w), y: rand(0, h), vx: rand(-0.35, 0.35), vy: rand(-0.35, 0.35), r: rand(1.2, 2.4) }));
      },
      pointer(x, y) {
        mouse = { x, y };
      },
      step(dt, w, h) {
        for (const p of pts) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          for (let j = i + 1; j < pts.length; j++) {
            const b = pts[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < LINK * LINK) {
              ctx.strokeStyle = rgba(accent, (1 - Math.sqrt(d2) / LINK) * 0.45);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
          if (mouse) {
            const dx = a.x - mouse.x;
            const dy = a.y - mouse.y;
            const d = Math.hypot(dx, dy);
            if (d < 170) {
              ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 170) * 0.5})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(mouse.x, mouse.y);
              ctx.stroke();
            }
          }
        }
        ctx.fillStyle = rgba(accent, 0.9);
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    };
  },

  matrix({ ctx, accent }) {
    const SIZE = 16;
    const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF';
    let cols = [];
    const color = rgba(accent, 0.9);
    return {
      noClear: true,
      resize(w, h) {
        ctx.clearRect(0, 0, w, h);
        const n = Math.ceil(w / SIZE);
        cols = Array.from({ length: n }, (_, i) => ({ x: i * SIZE, y: rand(-h, 0), v: rand(0.25, 0.7), on: Math.random() < 0.72 }));
      },
      step(dt, w, h) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${0.07 * dt})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `${SIZE - 2}px ui-monospace, monospace`;
        for (const c of cols) {
          if (!c.on) continue;
          const before = Math.floor(c.y / SIZE);
          c.y += c.v * SIZE * 0.35 * dt;
          const row = Math.floor(c.y / SIZE);
          if (row !== before && c.y > 0) {
            ctx.fillStyle = Math.random() < 0.1 ? '#ffffff' : color;
            ctx.fillText(pickOne(CHARS), c.x, row * SIZE);
          }
          if (c.y > h + rand(0, 400)) {
            c.y = rand(-200, 0);
            c.v = rand(0.25, 0.7);
          }
        }
      },
    };
  },

  hearts({ ctx, accent }) {
    const colors = [rgba(accent, 1), '#ff6b9d', '#ff8fab', '#f472b6'];
    const sprites = colors.map((col) => sprite(48, (c, s) => {
      c.fillStyle = col;
      heartPath(c, s / 2, s * 0.12, s * 0.78);
      c.fill();
    }));
    let hearts = [];
    const make = (w, h, bottom = false) => ({
      x: rand(0, w), y: bottom ? h + rand(10, 80) : rand(0, h), s: rand(10, 26), v: rand(0.35, 1.1),
      t: rand(0, 6.28), rot: rand(-0.4, 0.4), a: rand(0.35, 0.85), img: pickOne(sprites),
    });
    return {
      resize(w, h) {
        const n = Math.min(45, Math.round((w * h) / 30000));
        hearts = Array.from({ length: n }, () => make(w, h));
      },
      step(dt, w, h) {
        for (const p of hearts) {
          p.y -= p.v * dt;
          p.t += 0.02 * dt;
          const x = p.x + Math.sin(p.t) * 18;
          if (p.y < -40) Object.assign(p, make(w, h, true));
          ctx.save();
          ctx.globalAlpha = p.a;
          ctx.translate(x, p.y);
          ctx.rotate(p.rot + Math.sin(p.t) * 0.2);
          ctx.drawImage(p.img, -p.s / 2, -p.s / 2, p.s, p.s);
          ctx.restore();
        }
      },
    };
  },

  sakura({ ctx }) {
    const colors = ['#ffc6d9', '#ffb3c8', '#ffd6e5', '#f9a8d4'];
    const sprites = colors.map((col) => sprite(40, (c, s) => {
      c.translate(s / 2, s / 2);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, -s * 0.42);
      c.bezierCurveTo(s * 0.34, -s * 0.3, s * 0.3, s * 0.3, 0, s * 0.42);
      c.bezierCurveTo(-s * 0.3, s * 0.3, -s * 0.34, -s * 0.3, -s * 0.08, -s * 0.38);
      c.lineTo(0, -s * 0.3);
      c.closePath();
      c.fill();
    }));
    let petals = [];
    const make = (w, h, top = false) => ({
      x: rand(-60, w), y: top ? rand(-60, -10) : rand(0, h), s: rand(9, 18), vy: rand(0.5, 1.3), vx: rand(0.3, 1),
      t: rand(0, 6.28), spin: rand(0.01, 0.04), rot: rand(0, 6.28), a: rand(0.6, 0.95), img: pickOne(sprites),
    });
    return {
      resize(w, h) {
        const n = Math.min(70, Math.round((w * h) / 20000));
        petals = Array.from({ length: n }, () => make(w, h));
      },
      step(dt, w, h) {
        for (const p of petals) {
          p.t += p.spin * dt;
          p.rot += p.spin * 1.5 * dt;
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin(p.t) * 0.6) * dt;
          if (p.y > h + 30 || p.x > w + 40) Object.assign(p, make(w, h, true));
          ctx.save();
          ctx.globalAlpha = p.a;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(Math.cos(p.t * 2), 1);
          ctx.drawImage(p.img, -p.s / 2, -p.s / 2, p.s, p.s);
          ctx.restore();
        }
      },
    };
  },
};

export const EFFECT_NAMES = Object.keys(EFFECTS);

/**
 * Startet einen Effekt auf dem Canvas. Gibt eine Funktion zum Stoppen zurück.
 * @param {HTMLCanvasElement} canvas
 * @param {string} type
 * @param {string} accentHex
 */
export function startEffect(canvas, type, accentHex) {
  const ctx = canvas?.getContext?.('2d');
  const factory = EFFECTS[type];
  if (!ctx || !factory) {
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    return () => {};
  }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  const fx = factory({ ctx, accent: hexToRgb(accentHex) });
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = performance.now();
  let stopped = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = canvas.clientWidth || window.innerWidth;
    const nh = canvas.clientHeight || window.innerHeight;
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.resize?.(w, h);
  }

  function frame(now) {
    if (stopped) return;
    const dt = Math.min(3, (now - last) / 16.667);
    last = now;
    if (!fx.noClear) ctx.clearRect(0, 0, w, h);
    fx.step(dt, w, h);
    raf = requestAnimationFrame(frame);
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const onMove = (e) => fx.pointer?.(e.clientX, e.clientY);
  window.addEventListener('pointermove', onMove, { passive: true });
  raf = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
