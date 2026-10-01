import { randomId } from '../../core/ids';
import type { Card } from './logic';

const SIZE = 256;
const QUALITY = 0.8;

/**
 * "my_sister-2024.jpg" → "My sister 2024". Camera names like "IMG_20240101_123456" are useless as
 * a person's name, so those come back empty and the setup screen asks for a real name.
 */
export function nameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base || /^(img|dsc|pxl|photo|image|screenshot|whatsapp image)\b/i.test(base) || /^\d[\d\s]*$/.test(base)) return '';
  return (base[0].toUpperCase() + base.slice(1)).slice(0, 24);
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(file); // respects EXIF rotation
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Square-crop and shrink a photo to a ~15 KB JPEG on this device. Only this small copy is ever
 * sent, and it goes straight to your partner's browser. Nothing is uploaded to a server.
 */
export async function photoToCard(file: File): Promise<Card> {
  const img = await decode(file);
  const w = img.width;
  const h = img.height;
  const side = Math.min(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  // Portraits: bias the crop upwards, where faces usually are.
  ctx.drawImage(img, (w - side) / 2, (h - side) * 0.3, side, side, 0, 0, SIZE, SIZE);
  if ('close' in img) img.close();
  return { id: `p${randomId().slice(0, 10)}`, name: nameFromFile(file.name), img: canvas.toDataURL('image/jpeg', QUALITY) };
}
