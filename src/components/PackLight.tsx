import { useEffect, useRef, type RefObject } from 'react';

/**
 * Luz que escapa por el corte del paquete: resplandor, haces que oscilan y partículas que suben.
 * Se dibuja en su propio canvas detrás del paquete y sigue su posición en cada cuadro
 * (si el paquete tiembla o baja, la luz va con él). Al repartir deja de emitir, lanza un
 * chorro de chispas hacia arriba y se apaga antes de desmontarse, sin cortes.
 */
interface Props {
  pack: RefObject<HTMLDivElement | null>;
  /** color del aviso de rareza */
  color: string;
  /** intensidad 0–4 (C…SSR+) */
  level: number;
  torn: boolean;
  dealing: boolean;
  reduced: boolean;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  white: boolean;
  streak: boolean;
  wob: number;
}

interface Ray {
  ox: number;
  ang: number;
  half: number;
  len: number;
  ph: number;
  sp: number;
  a: number;
}

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** la capa de haces se dibuja a 1/6 de resolución y se amplía: el suavizado bilineal hace de desenfoque barato */
const LOW = 6;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(f, 16);
  return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sprite(r: number, g: number, b: number, white: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(white ? 0.3 : 0.14, white ? 'rgba(255,255,255,0.9)' : `rgba(${r},${g},${b},1)`);
  grd.addColorStop(0.42, `rgba(${r},${g},${b},0.32)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

export function PackLight({ pack, color, level, torn, dealing, reduced }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ torn, dealing, tornAt: 0, dealAt: 0 });

  useEffect(() => {
    const s = live.current;
    if (torn && !s.torn) s.tornAt = performance.now();
    if (dealing && !s.dealing) s.dealAt = performance.now();
    s.torn = torn;
    s.dealing = dealing;
  }, [torn, dealing]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const low = document.createElement('canvas');
    const lctx = low.getContext('2d')!;
    const [r, g, b] = rgb(color);
    const sprites = { tint: sprite(r, g, b, false), white: sprite(r, g, b, true) };
    const rgba = (a: number) => `rgba(${r},${g},${b},${Math.max(0, a).toFixed(3)})`;
    const k = reduced ? 0.4 : 1;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let box = { left: 0, top: 0 };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      box = { left: rect.left, top: rect.top };
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      low.width = Math.max(1, Math.round(W / LOW));
      low.height = Math.max(1, Math.round(H / LOW));
    };
    resize();
    window.addEventListener('resize', resize);

    const cone = 0.3 + level * 0.07;
    const rays: Ray[] = Array.from({ length: 7 + level * 2 }, () => ({
      ox: rand(-0.36, 0.36),
      ang: rand(-cone, cone),
      half: rand(0.025, 0.08),
      len: rand(0.55, 1),
      ph: rand(0, TAU),
      sp: rand(0.5, 1.4),
      a: rand(0.45, 1),
    }));
    const motes: Mote[] = [];
    const spawn = (x: number, y: number, pw: number, o: { n: number; vy: [number, number]; spread: number; life: [number, number]; streak?: number; size?: [number, number] }) => {
      for (let i = 0; i < Math.round(o.n * k); i++) {
        const off = rand(-0.42, 0.42);
        const life = rand(...o.life);
        motes.push({
          x: x + off * pw,
          y: y + rand(-2, 6),
          vx: off * o.spread + rand(-18, 18),
          vy: -rand(...o.vy),
          life,
          max: life,
          size: rand(...(o.size ?? [1.2, 3.2])) * (1 + level * 0.08),
          white: Math.random() < 0.28,
          streak: Math.random() < (o.streak ?? 0),
          wob: rand(0, TAU),
        });
      }
    };

    let raf = 0;
    let last = performance.now();
    let emitAcc = 0;
    let flicker = 1;
    let flickerAt = 0;
    let burstDone = false;
    let dealDone = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const el = pack.current?.querySelector('.pack-body') ?? pack.current;
      if (!el || !st.torn) return;

      // ancla: borde superior del cuerpo del paquete (el corte)
      const rc = el.getBoundingClientRect();
      const sx = rc.left + rc.width / 2 - box.left;
      const sy = rc.top - box.top;
      const pw = rc.width;

      // intensidad: encendido con destello, latido/parpadeo en rarezas altas, apagado al repartir
      const since = (now - st.tornAt) / 1000;
      const ignite = Math.min(1, since / 0.45);
      let I = (1 - (1 - ignite) ** 3) * (1 + 0.5 * Math.max(0, 1 - since / 0.25));
      if (level >= 3 && !reduced) {
        if (now - flickerAt > 70) {
          flicker = 0.8 + Math.random() * 0.2;
          flickerAt = now;
        }
        I *= flicker * (1 + 0.12 * Math.sin(since * TAU * 2.4));
      }
      // al repartir: destello breve que se expande desde el paquete (que va bajando) y se apaga
      const dealT = st.dealing ? (now - st.dealAt) / 1000 : 0;
      const out = st.dealing ? Math.max(0, 1 - dealT / 0.42) : 1;
      const fade = st.dealing ? Math.max(0, 1 - dealT / 0.62) : 1;
      const pop = st.dealing ? 1 + 0.9 * Math.max(0, 1 - dealT / 0.14) : 1;
      const spreadK = 1 + dealT * 2.4;
      I *= out * pop;

      if (!burstDone) {
        burstDone = true;
        spawn(sx, sy, pw, { n: 34 + level * 16, vy: [150, 380 + level * 60], spread: 260, life: [0.6, 1.3], streak: 0.35 });
      }
      if (st.dealing && !dealDone) {
        dealDone = true;
        // chispas rápidas y finas: se leen como estelas, no como una franja de luz quieta
        spawn(sx, sy, pw, { n: 20 + level * 9, vy: [700, 1200], spread: 520, life: [0.22, 0.42], streak: 1, size: [1, 2] });
      }
      if (!st.dealing) {
        emitAcc += dt * (26 + level * 20) * k;
        const n = Math.floor(emitAcc);
        emitAcc -= n;
        if (n) spawn(sx, sy, pw, { n: n / k, vy: [55 + level * 18, 150 + level * 40], spread: 90 + level * 25, life: [0.9, 1.9], streak: level >= 2 ? 0.12 : 0 });
      }

      // capa suave: resplandor del corte + haces (a baja resolución, luego ampliada)
      if (I > 0.003) {
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.clearRect(0, 0, low.width, low.height);
        lctx.setTransform(1 / LOW, 0, 0, 1 / LOW, 0, 0);
        lctx.globalCompositeOperation = 'lighter';
        const reach = Math.max(160, sy * 0.95);
        const sway = reduced ? 0 : 0.07;
        for (const ray of rays) {
          const ang = -Math.PI / 2 + ray.ang + sway * Math.sin(since * ray.sp + ray.ph);
          const len = reach * ray.len * (0.35 + 0.65 * ignite) * (0.92 + 0.08 * Math.sin(since * ray.sp * 1.7 + ray.ph));
          const ox = sx + ray.ox * pw;
          const cx = Math.cos(ang);
          const cy = Math.sin(ang);
          const tx = ox + cx * len;
          const ty = sy + cy * len;
          const base = pw * 0.05;
          const tip = len * Math.tan(ray.half);
          const grd = lctx.createLinearGradient(ox, sy, tx, ty);
          const a = ray.a * I * (0.75 + 0.25 * Math.sin(since * ray.sp * 2.3 + ray.ph));
          grd.addColorStop(0, rgba(0.6 * a));
          grd.addColorStop(0.3, rgba(0.26 * a));
          grd.addColorStop(1, rgba(0));
          lctx.fillStyle = grd;
          lctx.beginPath();
          lctx.moveTo(ox + cy * base, sy - cx * base);
          lctx.lineTo(tx + cy * tip, ty - cx * tip);
          lctx.lineTo(tx - cy * tip, ty + cx * tip);
          lctx.lineTo(ox - cy * base, sy + cx * base);
          lctx.closePath();
          lctx.fill();
        }
        // resplandor elíptico en el corte
        lctx.save();
        lctx.translate(sx, sy);
        lctx.scale(1, 0.42);
        const R = pw * (0.78 + level * 0.06) * spreadK;
        const core = lctx.createRadialGradient(0, 0, 0, 0, 0, R);
        core.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.85 * I).toFixed(3)})`);
        core.addColorStop(0.25, rgba(0.6 * I));
        core.addColorStop(1, rgba(0));
        lctx.fillStyle = core;
        lctx.beginPath();
        lctx.arc(0, 0, R, 0, TAU);
        lctx.fill();
        lctx.restore();
        // halo amplio por encima del paquete
        const halo = lctx.createRadialGradient(sx, sy - pw * 0.35, 0, sx, sy - pw * 0.35, pw * 1.5);
        halo.addColorStop(0, rgba(0.2 * I));
        halo.addColorStop(1, rgba(0));
        lctx.fillStyle = halo;
        lctx.fillRect(sx - pw * 1.5, sy - pw * 1.85, pw * 3, pw * 3);

        ctx.globalCompositeOperation = 'lighter';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(low, 0, 0, W, H);
      }

      // partículas
      ctx.globalCompositeOperation = 'lighter';
      let w = 0;
      for (const m of motes) {
        m.life -= dt;
        if (m.life <= 0) continue;
        motes[w++] = m;
        m.vx += Math.sin(now / 320 + m.wob) * 22 * dt;
        m.vx *= 1 - 0.8 * dt;
        m.vy *= 1 - 0.35 * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const t = m.life / m.max;
        const alpha = Math.min(1, t * 1.8) * Math.min(1, (m.max - m.life) / 0.12) * fade;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        const size = m.size * (0.55 + 0.45 * t);
        if (m.streak) {
          ctx.strokeStyle = m.white ? 'rgba(255,255,255,0.9)' : rgba(0.95);
          ctx.lineWidth = size * 0.7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 0.045, m.y - m.vy * 0.045);
          ctx.stroke();
        }
        const spr = m.white ? sprites.white : sprites.tint;
        const halo = m.streak ? 3 : 6;
        ctx.drawImage(spr, m.x - (size * halo) / 2, m.y - (size * halo) / 2, size * halo, size * halo);
      }
      motes.length = w;
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [pack, color, level, reduced]);

  return <canvas ref={ref} className="pack-light" aria-hidden="true" />;
}
