export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  in: (k) => k * k * k,
  outBack: (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2),
};
export const pulse = (t, a, b, fade = 0.3) => Math.min(seg(t, a, a + fade), 1 - seg(t, b - fade, b));

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FALLBACK = {
  "--color-paper": "#F6F0E3", "--color-paper-2": "#FFFDF8", "--color-paper-3": "#EDE4D1",
  "--color-ink": "#23281F", "--color-ink-2": "#3F4638", "--color-muted": "#666C5C", "--color-rule": "#DDD3BD",
  "--color-accent": "#4F6B4A", "--color-focus": "#2E4230",
  "--c-sage": "#A9BFA0", "--c-sage-soft": "#D3DEC8", "--c-moss": "#4F6B4A", "--c-moss-deep": "#2E4230",
  "--c-oat": "#E6CD9C", "--c-oat-deep": "#C89A58", "--c-toast": "#A9743C", "--c-clay": "#CF8E6A",
  "--c-skin": "#B97A56", "--c-hair": "#3A2A22", "--c-wood": "#D8B88A", "--c-frame": "#1B1F1A",
  "--c-screen": "#F2ECDD", "--c-glow": "#E9FFD2", "--c-ground-shadow": "#7A6540",
  "--c-skin-2": "#E0AC85", "--c-skin-3": "#8A5A3C", "--c-skin-4": "#F0C9A4",
  "--c-hair-2": "#6B4A32", "--c-hair-3": "#1E1914", "--c-hair-4": "#B9803F", "--c-hair-5": "#C9C2B4",
  "--c-dusk": "#6F8793", "--c-dusk-soft": "#BFD0D3", "--c-rose": "#D9A39A",
  "--font-display": "'Young Serif', Georgia, serif", "--font-body": "'Hanken Grotesk', system-ui, sans-serif", "--font-outlier": "Caveat, cursive",
};

let styles = null;
export function tok(name) {
  styles ||= getComputedStyle(document.documentElement);
  return styles.getPropertyValue(name).trim() || FALLBACK[name] || "#888888";
}

export function canvasTexture(THREE, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, tex, g: canvas.getContext("2d") };
}

export function wrapText(g, text, x, y, maxW, lineH, maxLines = 99) {
  const words = text.split(" ");
  let line = "";
  let n = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + n * lineH);
      n++;
      if (n >= maxLines) return n;
      line = word;
    } else line = test;
  }
  if (line) {
    g.fillText(line, x, y + n * lineH);
    n++;
  }
  return n;
}
