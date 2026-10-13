import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { drawScene, type Env } from './render';
import { FORMATS, type ShareScene } from './types';

/** Duración de un bucle de animación (GIF y video). */
export const LOOP_MS = 2400;
const GIF_FRAMES = 30;
const GIF_SCALE = 0.5;

function canvasFor(scene: ShareScene, scale = 1) {
  const { w, h } = FORMATS[scene.options.format];
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  return c;
}

/** Cede el hilo para que la UI pinte el progreso; con la pestaña oculta rAF se pausa, así que se usa un mensaje. */
const nextFrame = () =>
  new Promise<void>((r) => {
    if (!document.hidden) return void requestAnimationFrame(() => r());
    const ch = new MessageChannel();
    ch.port1.onmessage = () => r();
    ch.port2.postMessage(0);
  });

export async function renderPng(scene: ShareScene, env: Env): Promise<Blob> {
  const c = canvasFor(scene);
  drawScene(c.getContext('2d')!, c.width, c.height, scene, 0.18, env);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

/** GIF en bucle; se codifica en el hilo principal cediendo entre fotogramas para no congelar la UI. */
export async function renderGif(scene: ShareScene, env: Env, onProgress: (p: number) => void): Promise<Blob> {
  const c = canvasFor(scene, GIF_SCALE);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const grab = (i: number) => {
    drawScene(ctx, c.width, c.height, scene, i / GIF_FRAMES, env);
    return ctx.getImageData(0, 0, c.width, c.height).data;
  };
  // Paleta global a partir de 3 fotogramas submuestreados: evita parpadeos de color entre cuadros.
  const px = c.width * c.height;
  const sample = new Uint8ClampedArray(Math.ceil(px / 4) * 4 * 3);
  let o = 0;
  for (const i of [0, Math.floor(GIF_FRAMES / 3), Math.floor((2 * GIF_FRAMES) / 3)]) {
    const f = grab(i);
    for (let p = 0; p < f.length && o < sample.length; p += 16) {
      sample[o++] = f[p];
      sample[o++] = f[p + 1];
      sample[o++] = f[p + 2];
      sample[o++] = 255;
    }
  }
  const pal = quantize(sample.subarray(0, o), 256);
  onProgress(0.08);
  await nextFrame();
  // Cada fotograma se dibuja y codifica al vuelo (no se guardan 30 cuadros en memoria).
  const gif = GIFEncoder();
  const delay = Math.round(LOOP_MS / GIF_FRAMES);
  for (let i = 0; i < GIF_FRAMES; i++) {
    const index = applyPalette(grab(i), pal);
    gif.writeFrame(index, c.width, c.height, { palette: i === 0 ? pal : undefined, delay, repeat: 0 });
    onProgress(0.08 + (0.92 * (i + 1)) / GIF_FRAMES);
    if (i % 2 === 1) await nextFrame();
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}

/** Mejor formato de video que soporte el navegador (MP4 primero: lo aceptan Instagram y WhatsApp). */
export function videoMime(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  const options = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export async function renderVideo(scene: ShareScene, env: Env, onProgress: (p: number) => void, loops = 3): Promise<Blob> {
  const mime = videoMime();
  if (!mime) throw new Error('video');
  const c = canvasFor(scene, 2 / 3);
  const ctx = c.getContext('2d')!;
  drawScene(ctx, c.width, c.height, scene, 0, env);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const total = LOOP_MS * loops;
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      const el = now - t0;
      drawScene(ctx, c.width, c.height, scene, (el % LOOP_MS) / LOOP_MS, env);
      onProgress(Math.min(1, el / total));
      if (el < total) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  return new Blob(chunks, { type: mime.split(';')[0] });
}

export const extensionFor = (type: string) => (type.includes('gif') ? 'gif' : type.includes('mp4') ? 'mp4' : type.includes('webm') ? 'webm' : 'png');

/** Copia una imagen PNG al portapapeles. Recibe la promesa para crear el ClipboardItem dentro del gesto del usuario (Safari). */
export async function copyImage(png: Promise<Blob>): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('clipboard');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export function canShareFiles(): boolean {
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/** Abre la hoja de compartir del sistema con el archivo. Devuelve false si el usuario canceló. */
export async function shareFile(blob: Blob, name: string, text: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) throw new Error('share');
  try {
    await navigator.share({ files: [file], text });
    return true;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return false;
    throw e;
  }
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
