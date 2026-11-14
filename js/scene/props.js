import * as THREE from "three";
import { canvasTexture, rng, tok } from "./util.js";
import { mat, rbox, sphere } from "./people.js";

export const BOOTH_COLORS = ["--c-moss", "--c-clay", "--c-dusk", "--c-oat-deep", "--c-sage"];
export const BOOTH_ICONS = ["ring", "cone", "cube", "diamond", "twin"];

function mesh(geo, material, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function iconMesh(kind, material) {
  const g = new THREE.Group();
  if (kind === "ring") g.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.04, 8, 20), material));
  else if (kind === "cone") g.add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 4), material));
  else if (kind === "cube") g.add(new THREE.Mesh(rbox(0.2, 0.2, 0.08, 0.03, 2), material));
  else if (kind === "diamond") {
    const d = new THREE.Mesh(rbox(0.19, 0.19, 0.08, 0.03, 2), material);
    d.rotation.z = Math.PI / 4;
    g.add(d);
  } else {
    [-0.09, 0.09].forEach((x) => {
      const s = new THREE.Mesh(sphere(0.085, 12, 8), material);
      s.position.x = x;
      g.add(s);
    });
  }
  return g;
}

export function labelTexture(text, { w = 512, h = 128, bg = null, fg = null, size = 64 } = {}) {
  const { canvas, tex, g } = canvasTexture(THREE, w, h);
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = fg || tok("--color-paper-2");
  g.font = `400 ${size}px ${tok("--font-display")}`;
  g.textBaseline = "middle";
  g.textAlign = "center";
  let s = size;
  while (g.measureText(text).width > w - 40 && s > 18) {
    s -= 2;
    g.font = `400 ${s}px ${tok("--font-display")}`;
  }
  g.fillText(text, w / 2, h / 2 + 3);
  tex.needsUpdate = true;
  return { tex, canvas };
}

export function buildBooth({ color = "--c-moss", icon = "ring", label = "", glow = true } = {}) {
  const group = new THREE.Group();
  const main = mat(tok(color));
  const pale = mat(tok("--color-paper-2"));
  const wood = mat(tok("--c-wood"), { roughness: 0.65 });

  group.add(mesh(rbox(1.9, 2.15, 0.1, 0.05), mat(tok("--c-sage-soft")), 0, 1.075, -0.55));
  group.add(mesh(rbox(1.78, 0.6, 0.72, 0.06), wood, 0, 0.3, 0));
  group.add(mesh(rbox(1.62, 0.44, 0.04, 0.03, 2), main, 0, 0.3, 0.37, false));
  group.add(mesh(rbox(1.9, 0.07, 0.8, 0.03, 2), pale, 0, 0.63, 0));
  const banner = mesh(rbox(1.64, 0.5, 0.08, 0.05), main, 0, 2.38, -0.5);
  group.add(banner);
  [-0.8, 0.8].forEach((x) => group.add(mesh(rbox(0.07, 2.3, 0.07, 0.03, 2), wood, x, 1.15, -0.5, false)));

  let labelTex = null;
  if (label) {
    labelTex = labelTexture(label, { bg: tok(color), w: 512, h: 128 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.355), new THREE.MeshBasicMaterial({ map: labelTex.tex, toneMapped: false }));
    plane.position.set(0.06, 2.38, -0.455);
    group.add(plane);
    const ic = iconMesh(icon, pale);
    ic.scale.setScalar(0.62);
    ic.position.set(-0.64, 2.38, -0.44);
    group.add(ic);
  } else {
    const ic = iconMesh(icon, pale);
    ic.position.set(0, 2.38, -0.44);
    group.add(ic);
  }

  const mon = new THREE.Group();
  mon.position.set(0.55, 0.66, -0.1);
  mon.add(mesh(rbox(0.4, 0.28, 0.04, 0.02, 2), mat(tok("--c-frame")), 0, 0.26, 0));
  mon.add(mesh(rbox(0.34, 0.22, 0.01, 0.01, 1), mat(tok("--c-screen"), { emissive: tok("--c-screen"), emissiveIntensity: 0.25 }), 0, 0.26, 0.026, false));
  mon.add(mesh(rbox(0.07, 0.12, 0.05, 0.02, 2), mat(tok("--c-metal") || "#999"), 0, 0.06, 0, false));
  group.add(mon);

  let ring = null;
  if (glow) {
    ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 40), new THREE.MeshBasicMaterial({ color: tok("--color-accent"), transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(1.0, 0.62, 1);
    ring.position.set(0, 0.012, 0.3);
    group.add(ring);
  }

  return { group, banner, ring, label: labelTex, front: new THREE.Vector3(0, 0, 1.15), top: new THREE.Vector3(0, 2.8, -0.4) };
}

export function buildCvStack(count = 50) {
  const group = new THREE.Group();
  const geo = rbox(1.0, 0.05, 0.74, 0.014, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const sheets = new THREE.InstancedMesh(geo, material, count);
  sheets.castShadow = true;
  sheets.receiveShadow = true;
  const r = rng(5);
  const a = new THREE.Color(tok("--color-paper-2"));
  const b = new THREE.Color(tok("--color-paper-3"));
  const jitter = [];
  for (let i = 0; i < count; i++) {
    jitter.push([(r() - 0.5) * 0.05, (r() - 0.5) * 0.05, (r() - 0.5) * 0.045]);
    sheets.setColorAt(i, a.clone().lerp(b, i % 2 ? 0.55 : 0.12 + r() * 0.1));
  }
  group.add(sheets);

  const { tex, g } = canvasTexture(THREE, 512, 384);
  g.fillStyle = tok("--color-paper-2");
  g.fillRect(0, 0, 512, 384);
  g.fillStyle = tok("--color-ink");
  g.fillRect(40, 38, 170, 16);
  g.fillStyle = tok("--color-rule");
  for (let y = 84; y < 340; y += 24) g.fillRect(40, y, y % 72 === 12 ? 380 : 430, 10);
  g.fillStyle = tok("--c-sage");
  g.fillRect(40, 70, 90, 6);
  tex.needsUpdate = true;
  const topSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.675), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  topSheet.rotation.x = -Math.PI / 2;
  group.add(topSheet);

  const pitch = 0.0665;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);

  function set(k, live = 0, topDrop = 0) {
    const n = Math.max(0, Math.min(count, Math.floor(k * count)));
    sheets.count = n;
    const sway = Math.sin(live * 0.9);
    for (let i = 0; i < n; i++) {
      const h = (i / count) ** 2;
      const [jx, jz, jr] = jitter[i];
      const drop = i === n - 1 ? topDrop : 0;
      pos.set(jx + sway * 0.045 * h, 0.03 + i * pitch + drop, jz);
      e.set(0, jr, 0);
      q.setFromEuler(e);
      m4.compose(pos, q, sc);
      sheets.setMatrixAt(i, m4);
    }
    sheets.instanceMatrix.needsUpdate = true;
    const top = n ? 0.03 + (n - 1) * pitch + 0.026 + (n ? topDrop : 0) : 0;
    topSheet.visible = n > 1;
    topSheet.position.set(jx(n) + sway * 0.045 * ((n / count) ** 2), top + 0.002, jz(n));
    topSheet.rotation.z = -jitter[Math.max(0, n - 1)][2];
    return top;
  }
  const jx = (n) => (n ? jitter[n - 1][0] : 0);
  const jz = (n) => (n ? jitter[n - 1][1] : 0);
  set(1);

  return { group, set, height: count * pitch + 0.1, count };
}

export function buildTabletDesk() {
  const group = new THREE.Group();
  const wood = mat(tok("--c-wood"), { roughness: 0.65 });
  group.add(mesh(rbox(1.5, 0.08, 0.7, 0.03, 2), wood, 0, 0.62, 0));
  [[-0.62, -0.25], [0.62, -0.25], [-0.62, 0.25], [0.62, 0.25]].forEach(([x, z]) => group.add(mesh(rbox(0.08, 0.6, 0.08, 0.03, 2), wood, x, 0.3, z, false)));
  const tablet = new THREE.Group();
  tablet.position.set(0, 0.68, 0.02);
  tablet.rotation.x = -0.9;
  tablet.add(mesh(rbox(1.0, 0.72, 0.05, 0.05), mat(tok("--c-frame"), { roughness: 0.4 }), 0, 0.34, 0));
  const { canvas, tex, g } = canvasTexture(THREE, 800, 576);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.662), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, 0.34, 0.027);
  tablet.add(screen);
  const stand = mesh(rbox(0.5, 0.05, 0.4, 0.02, 2), mat(tok("--c-metal")), 0, 0.665, -0.12, false);
  group.add(stand);
  group.add(tablet);
  const tapRing = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 24), new THREE.MeshBasicMaterial({ color: tok("--color-accent"), transparent: true, opacity: 0, depthWrite: false }));
  tapRing.position.z = 0.03;
  tablet.add(tapRing);
  return { group, tablet, canvas, tex, g, tapRing };
}

export function buildPlant(scale = 1) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 10), mat(tok("--c-toast")), 0, 0.13, 0));
  const leaf = mat(tok("--c-moss"));
  [[0, 0.5, 0, 0.2], [-0.12, 0.42, 0.05, 0.15], [0.13, 0.44, -0.03, 0.16], [0.02, 0.62, 0.04, 0.13]].forEach(([x, y, z, r]) => group.add(mesh(sphere(r, 10, 8), leaf, x, y, z)));
  group.scale.setScalar(scale);
  return group;
}

export function buildHall({ w = 14.6, d = 9.6, wall = true, bunting = true } = {}) {
  const group = new THREE.Group();
  const slab = mesh(rbox(w + 0.5, 0.36, d + 0.5, 0.16, 3), mat(tok("--c-oat-deep"), { roughness: 0.85 }), 0, -0.18, 0, false);
  group.add(slab);

  const { tex, g } = canvasTexture(THREE, 512, 512);
  g.fillStyle = tok("--color-paper-2");
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = tok("--color-paper-3");
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 2.4, d / 2.4);
  tex.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  group.add(floor);

  const rug = mesh(rbox(w * 0.62, 0.02, d * 0.34, 0.01, 1), mat(tok("--c-sage-soft")), 0, 0.012, d * 0.2, false);
  group.add(rug);

  if (wall) {
    group.add(mesh(rbox(w + 0.5, 3.3, 0.24, 0.1), mat(tok("--c-oat")), 0, 1.65, -d / 2 - 0.02));
    group.add(mesh(rbox(0.24, 3.3, d + 0.5, 0.1), mat(tok("--c-oat")), -w / 2 - 0.1, 1.65, 0));
    group.add(mesh(rbox(0.24, 3.3, d + 0.5, 0.1), mat(tok("--c-oat")), w / 2 + 0.1, 1.65, 0));
  }
  if (bunting) {
    const cols = ["--c-clay", "--c-sage", "--c-oat-deep", "--c-dusk", "--c-moss"].map((c) => mat(tok(c), { side: THREE.DoubleSide, roughness: 0.9 }));
    const tri = new THREE.Shape();
    tri.moveTo(-0.14, 0);
    tri.lineTo(0.14, 0);
    tri.lineTo(0, -0.3);
    const triGeo = new THREE.ShapeGeometry(tri);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = (u - 0.5) * (w - 0.6);
      const y = 3.2 - Math.sin(u * Math.PI) * 0.36 - 0.03;
      const flag = new THREE.Mesh(triGeo, cols[i % cols.length]);
      flag.position.set(x, y, -d / 2 + 0.16);
      flag.rotation.z = (u - 0.5) * -0.2;
      group.add(flag);
    }
  }
  return group;
}

export function softShadowTexture() {
  const { tex, g } = canvasTexture(THREE, 64, 64);
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, "rgba(72,58,30,0.5)");
  grad.addColorStop(1, "rgba(72,58,30,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  tex.needsUpdate = true;
  return tex;
}
