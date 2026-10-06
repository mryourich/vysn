/** Loads an uploaded logo, scales it down and converts it to a PNG data URL (works for PNG, JPG, SVG, WebP). */
export function readLogo(file: File, maxW = 800, maxH = 400): Promise<{ dataUrl: string; ratio: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Bildformat wird nicht unterstützt.'));
      img.onload = () => {
        const w = img.naturalWidth || 300;
        const h = img.naturalHeight || 150;
        const scale = Math.min(1, maxW / w, maxH / h);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Bild konnte nicht verarbeitet werden.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/png'), ratio: canvas.width / canvas.height });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Entfernt einen einfarbigen Hintergrund (typisch bei Logos auf Weiß):
 * Ausgehend vom Bildrand werden alle zusammenhängenden Pixel, die der
 * Randfarbe ähneln, transparent gemacht. Innenflächen in Hintergrundfarbe
 * (z. B. das Loch im „O“) bleiben erhalten, wenn sie nicht mit dem Rand verbunden sind –
 * mit `holes` werden auch diese entfernt. Kanten werden weich ausgeblendet.
 */
export function removeBackground(dataUrl: string, tolerance = 40, holes = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('Bild konnte nicht verarbeitet werden.'));
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, w, h);
      const px = image.data;

      // Hintergrundfarbe = Durchschnitt der Randpixel
      let r = 0, g = 0, b = 0, n = 0;
      const sample = (x: number, y: number) => {
        const i = (y * w + x) * 4;
        if (px[i + 3] < 16) return;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      };
      for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
      for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
      if (!n) return resolve(dataUrl); // Rand ist bereits transparent
      r /= n; g /= n; b /= n;

      const dist = (i: number) => Math.sqrt((px[i] - r) ** 2 + (px[i + 1] - g) ** 2 + (px[i + 2] - b) ** 2);
      const soft = tolerance * 1.6;
      const visited = new Uint8Array(w * h);
      const stack: number[] = [];
      const push = (x: number, y: number) => {
        const p = y * w + x;
        if (!visited[p]) { visited[p] = 1; stack.push(p); }
      };
      if (holes) {
        for (let p = 0; p < w * h; p++) stack.push(p);
      } else {
        for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
        for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      }
      while (stack.length) {
        const p = stack.pop()!;
        const i = p * 4;
        const d = dist(i);
        if (d > soft) continue;
        // weicher Übergang zwischen Toleranz und weicher Grenze
        const alpha = d <= tolerance ? 0 : Math.round(((d - tolerance) / (soft - tolerance)) * 255);
        px[i + 3] = Math.min(px[i + 3], alpha);
        if (holes || d > tolerance) continue; // nur durch echten Hintergrund weiterwachsen
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) push(x - 1, y);
        if (x < w - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < h - 1) push(x, y + 1);
      }
      ctx.putImageData(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}
