const NS = "http://www.w3.org/2000/svg";

const SKIN = ["--c-skin-4", "--c-skin-2", "--c-skin", "--c-skin-3", "--c-clay"];
const HAIR = ["--c-hair-3", "--c-hair", "--c-hair-2", "--c-hair-4", "--c-hair-5"];
const SHIRT = ["--c-moss", "--c-clay", "--c-dusk", "--c-oat-deep", "--c-sage", "--c-toast"];
const BACK = ["--c-sage-soft", "--c-dusk-soft", "--c-oat", "--color-paper-3"];
const STYLES = ["short", "bun", "long", "curly"];
const BOOTH_COLORS = ["--c-moss", "--c-clay", "--c-dusk", "--c-oat-deep", "--c-sage"];
const BOOTH_ICONS = ["ring", "cone", "cube", "diamond", "twin"];

const CAST = {
  "p-ahmed": { skin: 3, hair: 0, style: "short", glasses: false, beard: true, shirt: 0, back: 0 },
  "m-maria": { skin: 0, hair: 2, style: "bun", glasses: true, beard: false, shirt: 3, back: 3 },
  "o-elina": { skin: 0, hair: 2, style: "long", glasses: false, beard: false, shirt: 2, back: 1 },
};

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function looksFor(key) {
  if (CAST[key]) return CAST[key];
  const n = hash(key);
  const style = STYLES[(n >>> 6) % STYLES.length];
  return {
    skin: n % SKIN.length,
    hair: (n >>> 3) % HAIR.length,
    style,
    glasses: (n >>> 9) % 4 === 0,
    beard: style === "short" && (n >>> 11) % 4 === 0,
    shirt: (n >>> 13) % SHIRT.length,
    back: (n >>> 16) % BACK.length,
  };
}

function node(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  kids.flat().forEach((k) => k && el.append(k));
  return el;
}

const fill = (token) => ({ style: `fill:var(${token})` });

function hairBack(look, color) {
  if (look.style === "long") return node("rect", { x: 12, y: 9, width: 40, height: 40, rx: 15, ...fill(color) });
  return null;
}

function hairFront(look, color) {
  const cap = node("rect", { x: 14, y: 8, width: 36, height: 13, rx: 8, ...fill(color) });
  if (look.style === "bun") return [node("circle", { cx: 32, cy: 8, r: 6.5, ...fill(color) }), cap];
  if (look.style === "curly") {
    return [10, 21, 32, 43, 54].map((cx, i) => node("circle", { cx, cy: i % 2 ? 14 : 12, r: 7, ...fill(color) }));
  }
  return cap;
}

export function managerKey(companyId) {
  return companyId === "c-tuulia" ? "m-maria" : `m-${companyId}`;
}

export function managerKeyFromName(name) {
  const clean = String(name || "").trim().toLowerCase();
  return clean === "maria lehtonen" ? "m-maria" : `m-${clean || "manager"}`;
}

export function avatar(key, { size = 56 } = {}) {
  const look = looksFor(String(key));
  const skin = SKIN[look.skin];
  const hair = HAIR[look.hair];
  const svg = node("svg", { class: "avatar", viewBox: "0 0 64 64", width: size, height: size, "aria-hidden": "true", focusable: "false" },
    node("rect", { width: 64, height: 64, rx: 18, ...fill(BACK[look.back]) }),
    node("rect", { x: 9, y: 46, width: 46, height: 26, rx: 14, ...fill(SHIRT[look.shirt]) }),
    node("rect", { x: 28.5, y: 53, width: 7, height: 8, rx: 2, ...fill("--color-paper-2") }),
    hairBack(look, hair),
    node("rect", { x: 16, y: 12, width: 32, height: 34, rx: 12, ...fill(skin) }),
    look.beard ? node("rect", { x: 18, y: 35, width: 28, height: 13, rx: 7, ...fill(hair) }) : null,
    hairFront(look, hair),
    node("circle", { cx: 26, cy: 29, r: 2.4, ...fill("--c-frame") }),
    node("circle", { cx: 38, cy: 29, r: 2.4, ...fill("--c-frame") }),
    node("circle", { cx: 21, cy: 35, r: 3, style: "fill:var(--c-rose);opacity:.55" }),
    node("circle", { cx: 43, cy: 35, r: 3, style: "fill:var(--c-rose);opacity:.55" }),
    look.glasses ? [26, 38].map((cx) => node("circle", { cx, cy: 29, r: 6.2, fill: "none", style: "stroke:var(--c-frame);stroke-width:1.5" })) : null,
    node("path", { d: "M27.5 38q4.5 3.4 9 0", fill: "none", "stroke-linecap": "round", style: `stroke:var(${look.beard ? "--color-paper-2" : "--c-frame"});stroke-width:1.9` }));
  return svg;
}

export const MARK_COUNT = BOOTH_COLORS.length;
export const MARK_COLOR_NAMES = ["Moss", "Clay", "Slate", "Ochre", "Sage"];
export const MARK_ICON_NAMES = ["Ring", "Triangle", "Square", "Diamond", "Two dots"];

export function companyMark(company, { size = 28 } = {}) {
  const slot = Number.isInteger(company && company.slot) ? company.slot : hash(String((company && company.id) || "c")) % BOOTH_COLORS.length;
  const wrapIndex = (n) => ((n % MARK_COUNT) + MARK_COUNT) % MARK_COUNT;
  const own = company && company.mark;
  const i = wrapIndex(slot);
  const colorIndex = own && Number.isInteger(own.color) ? wrapIndex(own.color) : i;
  const iconIndex = own && Number.isInteger(own.icon) ? wrapIndex(own.icon) : i;
  const white = { style: "fill:var(--color-paper-2)" };
  const stroke = { fill: "none", style: "stroke:var(--color-paper-2);stroke-width:3.2" };
  const icons = {
    ring: node("circle", { cx: 16, cy: 16, r: 6, ...stroke }),
    cone: node("path", { d: "M16 8l8 15H8z", ...white, "stroke-linejoin": "round" }),
    cube: node("rect", { x: 9, y: 9, width: 14, height: 14, rx: 3, ...white }),
    diamond: node("rect", { x: 10, y: 10, width: 12, height: 12, rx: 2.5, transform: "rotate(45 16 16)", ...white }),
    twin: [node("circle", { cx: 11.5, cy: 16, r: 3.6, ...white }), node("circle", { cx: 20.5, cy: 16, r: 3.6, ...white })],
  };
  return node("svg", { class: "company-mark", viewBox: "0 0 32 32", width: size, height: size, "aria-hidden": "true", focusable: "false" },
    node("rect", { width: 32, height: 32, rx: 9, ...fill(BOOTH_COLORS[colorIndex]) }),
    icons[BOOTH_ICONS[iconIndex]]);
}

export function plainStack(label, company, { size = 56 } = {}) {
  const wrap = document.createElement("span");
  wrap.className = "avatar-stack";
  wrap.style.setProperty("--avatar", `${size}px`);
  const plain = document.createElement("span");
  plain.className = "avatar-plain";
  plain.textContent = label;
  plain.setAttribute("aria-hidden", "true");
  wrap.append(plain);
  if (company) wrap.append(companyMark(company, { size: Math.round(size * 0.46) }));
  return wrap;
}

export function avatarStack(personKey, company, { size = 56 } = {}) {
  const wrap = document.createElement("span");
  wrap.className = "avatar-stack";
  wrap.style.setProperty("--avatar", `${size}px`);
  wrap.append(avatar(personKey, { size }));
  if (company) wrap.append(companyMark(company, { size: Math.round(size * 0.46) }));
  return wrap;
}
