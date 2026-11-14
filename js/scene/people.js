import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";
import { tok } from "./util.js";

const geoCache = new Map();
const matCache = new Map();

export function rbox(w, h, d, r = 0.05, seg = 3) {
  const key = [w, h, d, r, seg].join("|");
  if (!geoCache.has(key)) geoCache.set(key, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
  return geoCache.get(key);
}

export function sphere(r, ws = 12, hs = 8) {
  const key = `s|${r}|${ws}|${hs}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(r, ws, hs));
  return geoCache.get(key);
}

export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra }));
  return matCache.get(key);
}

export function clearCaches() {
  geoCache.forEach((g) => g.dispose());
  matCache.forEach((m) => m.dispose());
  geoCache.clear();
  matCache.clear();
}

export const SKINS = ["--c-skin", "--c-skin-2", "--c-skin-3", "--c-skin-4"];
export const HAIRS = ["--c-hair", "--c-hair-2", "--c-hair-3", "--c-hair-4", "--c-hair-5"];
export const TOPS = ["--c-clay", "--c-sage", "--c-moss", "--c-oat-deep", "--c-dusk", "--c-rose", "--c-toast", "--c-oat"];
export const STYLES = ["short", "bun", "long", "curly", "cap", "short"];

function part(geo, material, x, y, z, cast = false) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  return m;
}

export function buildPerson({ skin, hair, top, bottom, hairStyle = "short", glasses = false, beard = false, badge = true, cast = true, low = false, scale = 1 } = {}) {
  const skinMat = mat(tok(skin || "--c-skin-2"), { roughness: 0.65 });
  const hairMat = mat(tok(hair || "--c-hair"), { roughness: 0.6 });
  const topMat = mat(tok(top || "--c-clay"));
  const botMat = mat(tok(bottom || "--c-moss-deep"));
  const darkMat = mat(tok("--c-frame"), { roughness: 0.35 });

  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  group.scale.setScalar(scale);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  [legL, legR].forEach((leg, i) => {
    leg.position.set(i ? 0.12 : -0.12, 0.3, 0);
    leg.add(part(rbox(0.17, 0.3, 0.2, 0.06, 2), botMat, 0, -0.15, 0.01, cast));
    inner.add(leg);
  });

  inner.add(part(rbox(0.5, 0.56, 0.32, 0.12), topMat, 0, 0.58, 0, cast));
  if (badge && !low) {
    inner.add(part(rbox(0.12, 0.15, 0.02, 0.02, 2), mat(tok("--color-paper-2")), 0.1, 0.6, 0.165));
    inner.add(part(rbox(0.02, 0.28, 0.01, 0.005, 1), mat(tok("--c-sage")), 0.1, 0.78, 0.162));
  }

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  [armL, armR].forEach((arm, i) => {
    arm.position.set(i ? 0.33 : -0.33, 0.8, 0);
    arm.add(part(rbox(0.13, 0.36, 0.15, 0.06, 2), topMat, 0, -0.17, 0, cast));
    arm.add(part(sphere(0.07, 8, 6), skinMat, 0, -0.38, 0));
    inner.add(arm);
  });

  const head = new THREE.Group();
  head.position.set(0, 1.07, 0);
  inner.add(head);
  head.add(part(rbox(0.46, 0.4, 0.4, 0.15, 4), skinMat, 0, 0, 0, cast));
  [-1, 1].forEach((s) => {
    const eye = part(sphere(0.034, 8, 6), darkMat, s * 0.1, 0.02, 0.19);
    eye.scale.set(1, 1.3, 0.6);
    head.add(eye);
    if (!low) {
      const ear = part(sphere(0.05, 8, 6), skinMat, s * 0.235, -0.01, 0);
      ear.scale.set(0.5, 1, 0.8);
      head.add(ear);
      const cheek = part(sphere(0.045, 8, 6), mat(tok("--c-clay"), { roughness: 0.9 }), s * 0.15, -0.065, 0.18);
      cheek.scale.set(1, 0.7, 0.3);
      head.add(cheek);
    }
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 4, 10, Math.PI * 0.8), darkMat);
  mouth.position.set(0, -0.075, 0.2);
  mouth.rotation.z = Math.PI + Math.PI * 0.1;
  head.add(mouth);
  if (!low) head.add(part(sphere(0.03, 8, 6), skinMat, 0, -0.025, 0.2));

  if (glasses && !low) {
    [-1, 1].forEach((s) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 6, 16), darkMat);
      ring.position.set(s * 0.1, 0.025, 0.205);
      head.add(ring);
    });
    head.add(part(rbox(0.06, 0.01, 0.01, 0.003, 1), darkMat, 0, 0.03, 0.205));
  }
  if (beard) head.add(part(rbox(0.38, 0.14, 0.12, 0.05, 2), hairMat, 0, -0.14, 0.14));

  const hairParts = {
    short: () => [part(rbox(0.5, 0.17, 0.46, 0.08, 3), hairMat, 0, 0.19, -0.01, cast), part(rbox(0.5, 0.3, 0.12, 0.06, 2), hairMat, 0, 0.06, -0.19)],
    cap: () => [part(rbox(0.49, 0.1, 0.44, 0.05, 2), hairMat, 0, 0.21, 0, cast)],
    bun: () => [part(rbox(0.5, 0.17, 0.46, 0.08, 3), hairMat, 0, 0.19, -0.01, cast), part(rbox(0.5, 0.28, 0.12, 0.06, 2), hairMat, 0, 0.07, -0.19), part(sphere(0.12, 10, 8), hairMat, 0, 0.34, -0.1, cast)],
    long: () => [part(rbox(0.52, 0.17, 0.46, 0.08, 3), hairMat, 0, 0.19, -0.01, cast), part(rbox(0.54, 0.62, 0.12, 0.07, 2), hairMat, 0, -0.1, -0.19), part(rbox(0.07, 0.4, 0.3, 0.03, 2), hairMat, -0.255, -0.02, -0.04), part(rbox(0.07, 0.4, 0.3, 0.03, 2), hairMat, 0.255, -0.02, -0.04)],
    curly: () => [[0, 0.22, 0], [-0.17, 0.18, 0.02], [0.17, 0.18, 0.02], [-0.2, 0.02, -0.08], [0.2, 0.02, -0.08], [0, 0.12, -0.18], [-0.1, 0.27, -0.06], [0.1, 0.27, -0.06]].map(([x, y, z]) => part(sphere(0.13, 8, 6), hairMat, x, y, z, cast)),
  };
  (hairParts[hairStyle] || hairParts.short)().forEach((m) => head.add(m));

  let wave = 0;
  let reach = 0;
  let point = 0;
  let talk = 0;
  let walk = 0;
  let walkPhase = 0;

  function animate(time, dt = 0.016) {
    walkPhase += dt * 7 * walk;
    const sw = Math.sin(walkPhase) * 0.55 * walk;
    legL.rotation.x = sw;
    legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.8 - reach * 1.3;
    armL.rotation.z = -0.06;
    armR.rotation.x = sw * 0.8 + point * 0.2;
    armR.rotation.z = 0.06 + point * 1.3 + wave * (2.5 + Math.sin(time * 11) * 0.32);
    inner.position.y = Math.abs(Math.sin(walkPhase)) * 0.045 * walk + Math.sin(time * 1.8 + group.id) * 0.006;
    head.rotation.x = Math.sin(time * 9) * 0.05 * talk;
    head.rotation.z = Math.sin(time * 1.3 + group.id) * 0.03;
  }

  return {
    group, inner, head, armL, armR, animate,
    set wave(v) { wave = v; },
    set reach(v) { reach = v; },
    set point(v) { point = v; },
    set talk(v) { talk = v; },
    set walk(v) { walk = v; },
    top: new THREE.Vector3(0, 1.62, 0),
    mouth: new THREE.Vector3(0, 1.0, 0.25),
  };
}

export function crowdLook(index, extra = {}) {
  return {
    skin: SKINS[index % SKINS.length],
    hair: HAIRS[(index * 3 + 1) % HAIRS.length],
    top: TOPS[(index * 5 + 2) % TOPS.length],
    hairStyle: STYLES[(index * 7 + 3) % STYLES.length],
    glasses: index % 5 === 2,
    beard: index % 7 === 3,
    ...extra,
  };
}
