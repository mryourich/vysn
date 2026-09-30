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
