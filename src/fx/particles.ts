/**
 * Sistema de partículas en un único <canvas> a pantalla completa.
 * Se anima sólo mientras hay partículas vivas.
 */
type Shape = 'spark' | 'dot' | 'shard' | 'ring' | 'star' | 'square';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: Shape;
  rot: number;
  vr: number;
  gravity: number;
  drag: number;
  grow: number;
}

export interface BurstOptions {
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  speed?: [number, number];
  size?: [number, number];
  life?: [number, number];
  shape?: Shape | Shape[];
  gravity?: number;
  drag?: number;
  spread?: number;
  angle?: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

class ParticleSystem {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;
  reduced = false;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.canvas = null;
    this.ctx = null;
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
  }

  burst(o: BurstOptions) {
    const count = Math.round((o.count ?? 30) * (this.reduced ? 0.25 : 1));
    const colors = o.colors ?? ['#ffffff'];
    const shapes = Array.isArray(o.shape) ? o.shape : [o.shape ?? 'spark'];
    for (let i = 0; i < count; i++) {
      const spread = o.spread ?? Math.PI * 2;
      const ang = (o.angle ?? -Math.PI / 2) + rand(-spread / 2, spread / 2);
      const sp = rand(...(o.speed ?? [2, 9]));
      const life = rand(...(o.life ?? [0.6, 1.4]));
      this.particles.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life,
        max: life,
        size: rand(...(o.size ?? [2, 5])),
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        rot: Math.random() * Math.PI * 2,
        vr: rand(-0.3, 0.3),
        gravity: o.gravity ?? 0.12,
        drag: o.drag ?? 0.975,
        grow: 0,
      });
    }
    this.start();
  }

  /** Onda expansiva circular. */
  ring(x: number, y: number, color: string, maxRadius = 260, life = 0.7, width = 4) {
    this.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size: width, color, shape: 'ring', rot: 0, vr: 0, gravity: 0, drag: 1, grow: maxRadius });
    this.start();
  }

  /** Lluvia suave desde arriba (confeti / polvo dorado). */
  rain(colors: string[], count = 80, shape: Shape = 'square') {
    const w = window.innerWidth;
    for (let i = 0; i < Math.round(count * (this.reduced ? 0.25 : 1)); i++) {
      const life = rand(1.6, 3);
      this.particles.push({
        x: rand(0, w), y: rand(-80, -10), vx: rand(-1, 1), vy: rand(1, 4), life, max: life, size: rand(3, 7),
        color: colors[Math.floor(Math.random() * colors.length)], shape, rot: Math.random() * 6, vr: rand(-0.2, 0.2), gravity: 0.05, drag: 0.99, grow: 0,
      });
    }
    this.start();
  }

  clear() {
    this.particles = [];
  }

  private start() {
    if (this.raf || !this.ctx) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const k = dt * 60;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      alive.push(p);
      p.vx *= Math.pow(p.drag, k);
      p.vy = p.vy * Math.pow(p.drag, k) + p.gravity * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.vr * k;
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case 'ring': {
          const r = p.grow * (1 - t) ** 0.6 + 4;
          ctx.lineWidth = p.size * t + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'spark': {
          ctx.lineWidth = p.size * 0.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
          ctx.stroke();
          break;
        }
        case 'shard': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.6);
          ctx.lineTo(p.size * 0.7, p.size);
          ctx.lineTo(-p.size * 0.8, p.size * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'star': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          const s = p.size;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(s * 0.25, s * 0.25, 0, s * 2);
            ctx.quadraticCurveTo(-s * 0.25, s * 0.25, 0, 0);
          }
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'square': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        }
        default: {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    this.particles = alive;
    if (alive.length) this.raf = requestAnimationFrame(this.frame);
    else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.raf = 0;
    }
  };
}

export const fx = new ParticleSystem();

/** Centro de un elemento en coordenadas de viewport. */
export function centerOf(el: Element | null): { x: number; y: number } {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
