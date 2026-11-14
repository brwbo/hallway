import * as THREE from "three";
import { ease, lerp, pulse, seg, tok } from "./util.js";
import { buildPerson, crowdLook } from "./people.js";
import { BOOTH_COLORS, BOOTH_ICONS, buildBooth, buildCvStack, buildHall, buildPlant, buildTabletDesk } from "./props.js";
import { buildEvidenceCard, buildNeedsCard, paintTablet } from "./cards.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const SHOTS = [
  [0.0, V(1.2, 5.4, 17.5), V(0.3, 1.5, -1.4), 30],
  [1.0, V(1.0, 5.0, 16.5), V(0.3, 1.6, -1.5), 30],
  [2.2, V(-1.7, 1.2, 2.7), V(-0.1, 2.25, -3.3), 44],
  [3.9, V(-1.5, 1.4, 2.9), V(-0.1, 2.2, -3.3), 44],
  [4.8, V(1.3, 1.55, 2.3), V(0.95, 1.2, -2.5), 36],
  [7.9, V(1.2, 1.6, 2.4), V(1.0, 1.2, -2.5), 36],
  [8.8, V(-0.5, 1.7, 5.9), V(2.45, 1.1, 0.0), 38],
  [11.2, V(-0.4, 1.7, 5.8), V(2.45, 1.1, 0.0), 38],
  [12.1, V(-2.1, 1.4, 2.7), V(-3.45, 0.95, 0.5), 33],
  [13.0, V(-2.0, 1.45, 2.8), V(-3.45, 0.95, 0.5), 33],
  [14.0, V(0.9, 3.4, 12.2), V(0.3, 1.5, -1.0), 30],
  [14.8, V(0.7, 3.3, 11.6), V(0.3, 1.5, -1.0), 30],
];
export const END = SHOTS[SHOTS.length - 1][0];

const KEEP_AT_END = new Set([1, 3, 6]);
const MARIA = V(0.45, 0, -2.55);
const AHMED = V(3.4, 0, 0.2);
const ELINA = V(-3.9, 0, 0.95);
const DESK = V(-3.4, 0, 0.4);
const NEEDS_AT = V(1.65, 1.45, -2.05);
const EVID_AT = V(2.0, 1.55, -0.55);
const ARC_A = V(0.45, 1.55, -2.5);
const ARC_B = V(3.4, 1.55, 0.2);

const pos = new THREE.Vector3();
const look = new THREE.Vector3();
const side = new THREE.Vector3();
const UP = V(0, 1, 0);
const a3 = new THREE.Vector3();

export function createFilmWorld(stage, { still = false } = {}) {
  const { scene, camera } = stage;
  scene.fog.near = 22;
  scene.fog.far = 48;
  scene.add(buildHall());

  const booths = [];
  for (let s = 0; s < 5; s++) {
    const b = buildBooth({ color: BOOTH_COLORS[s], icon: BOOTH_ICONS[s], label: s === 2 ? "Tuulia Software" : "", glow: false });
    b.group.position.set((s - 2) * 2.5, 0, -3.4);
    scene.add(b.group);
    booths.push(b);
  }

  const stack = buildCvStack(50);
  stack.group.position.set(-0.45, 0.67, -3.35);
  stack.group.rotation.y = 0.04;
  scene.add(stack.group);

  const maria = buildPerson({ skin: "--c-skin-4", hair: "--c-hair-2", top: "--c-oat-deep", hairStyle: "bun", glasses: true });
  maria.group.position.copy(MARIA);
  const ahmed = buildPerson({ skin: "--c-skin-3", hair: "--c-hair-3", top: "--c-moss", hairStyle: "short", beard: true });
  ahmed.group.position.copy(AHMED);
  const elina = buildPerson({ skin: "--c-skin-2", hair: "--c-hair-4", top: "--c-dusk", hairStyle: "long" });
  elina.group.position.copy(ELINA);
  scene.add(maria.group, ahmed.group, elina.group);

  const crowd = [];
  const place = (i, x, z, yaw, extra = {}) => {
    const p = buildPerson(crowdLook(i, extra));
    p.group.position.set(x, 0, z);
    p.group.rotation.y = yaw;
    p.base = { x, z, yaw };
    scene.add(p.group);
    crowd.push(p);
    return p;
  };
  [[0, -6.5, -2.75, 0.3], [1, -2.3, -2.9, -0.2], [3, 2.7, -2.9, 0.2], [4, 6.4, -2.75, -0.3]].forEach(([s, x, z, yaw]) => place(s + 1, x, z, yaw));
  [[5, -5.6, 0.2, 0.9], [6, -3.0, -0.5, 0.3], [7, -0.3, -0.9, -0.4], [8, 5.7, -0.6, -0.9], [9, -1.8, -1.6, -0.2], [10, -3.0, -1.1, 0.5]].forEach(([i, x, z, yaw]) => place(i, x, z, yaw));
  const walkers = [place(11, -6, -1.3, Math.PI / 2), place(12, 6, -1.8, -Math.PI / 2)];
  walkers.forEach((w) => {
    w.walk = 0.35;
  });

  [[-6.4, -4.1, 1.2], [6.4, -4.1, 1.2], [-6.5, 3.6, 1], [6.5, 3.6, 1]].forEach(([x, z, s]) => {
    const p = buildPlant(s);
    p.position.set(x, 0, z);
    scene.add(p);
  });

  const desk = buildTabletDesk();
  desk.group.position.copy(DESK);
  desk.tablet.scale.setScalar(1.3);
  desk.tapRing.position.set(-0.257, 0.11, 0.03);
  scene.add(desk.group);
  const tabletState = { show: -1, press: -1, done: -1 };

  const needs = buildNeedsCard();
  const evidence = buildEvidenceCard();
  scene.add(needs.group, evidence.group);

  const arcPts = new THREE.QuadraticBezierCurve3(ARC_A, V((ARC_A.x + ARC_B.x) / 2, 4.1, (ARC_A.z + ARC_B.z) / 2), ARC_B);
  const arcGeo = new THREE.TubeGeometry(arcPts, 48, 0.045, 8, false);
  const arcCount = arcGeo.index.count;
  const arc = new THREE.Mesh(arcGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(tok("--c-moss")), roughness: 0.6 }));
  arc.castShadow = true;
  scene.add(arc);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(tok("--c-glow")) }));
  scene.add(spark);

  const anchors = { stack: { x: 0, y: 0 }, maria: { x: 0, y: 0 }, ahmed: { x: 0, y: 0 }, elina: { x: 0, y: 0 }, needs: { x: 0, y: 0 }, tablet: { x: 0, y: 0 } };

  function cameraAt(t, view) {
    let i = 0;
    while (i < SHOTS.length - 2 && t > SHOTS[i + 1][0]) i++;
    const a = SHOTS[i];
    const b = SHOTS[i + 1];
    const k = ease.inOut(seg(t, a[0], b[0]));
    pos.lerpVectors(a[1], b[1], k);
    look.lerpVectors(a[2], b[2], k);
    const fov = lerp(a[3], b[3], k);
    const sway = t < 1.2 || t > 13.6 ? 0.5 : 0.1;
    side.subVectors(look, pos).cross(UP).normalize();
    pos.addScaledVector(side, view.px * sway);
    pos.y -= view.py * sway * 0.5;
    stage.setShot(pos, look, fov);
    const { w, h } = stage.size;
    if (view.shiftX || view.shiftY) camera.setViewOffset(w, h, -view.shiftX * w, -view.shiftY * h, w, h);
    else if (camera.view) camera.clearViewOffset();
    camera.updateMatrixWorld(true);
  }

  function faceCard(card, at, shot, t, lift) {
    const c = SHOTS[shot][1];
    const yaw = Math.atan2(c.x - at.x, c.z - at.z);
    card.group.position.set(at.x, at.y + Math.sin(t * 1.4) * 0.012 + lift, at.z);
    card.group.rotation.set(0, yaw + Math.sin(t * 0.9) * 0.025, Math.sin(t * 0.7) * 0.012);
  }

  function update(t, view) {
    const live = view.live;
    cameraAt(t, view);

    const stackK = 0.72 + 0.28 * ease.out(seg(t, 0.8, 3.3));
    stack.set(stackK, live, stackK < 1 ? (1 - ((stackK * 50) % 1)) * 0.5 : 0);

    const mariaTalk = pulse(t, 4.9, 6.0, 0.15);
    const ahmedTalk = pulse(t, 9.3, 10.9, 0.15);
    const meet = ease.inOut(seg(t, 13.0, 13.8));
    const wave = ease.out(seg(t, 13.6, 13.95));

    maria.talk = mariaTalk;
    maria.wave = wave;
    maria.animate(live, 0.016);
    maria.group.rotation.y = lerp(0.12, 1.0, meet);
    maria.head.rotation.y = Math.sin(live * 1.1) * 0.06 + 0.3 * ease.inOut(seg(t, 5.8, 6.4)) * (1 - ease.inOut(seg(t, 7.6, 8.2)));

    ahmed.talk = ahmedTalk;
    ahmed.wave = wave;
    ahmed.animate(live + 2, 0.016);
    ahmed.group.rotation.y = lerp(-0.62, -1.35, meet);

    const pointK = ease.inOut(seg(t, 12.2, 12.6)) * (1 - ease.inOut(seg(t, 13.1, 13.5)));
    elina.point = pointK;
    elina.talk = 0;
    elina.animate(live + 4, 0.016);
    elina.group.rotation.y = 0.8;

    crowd.forEach((p, i) => {
      if (walkers.includes(p)) return;
      p.animate(live + i * 1.7, 0.016);
      p.group.rotation.y = p.base.yaw + Math.sin(live * 0.4 + i) * 0.15;
    });
    walkers.forEach((w, i) => {
      const ph = live * 0.22 + i * 2.1;
      w.group.position.x = (i ? 5.5 : -5.4) + Math.sin(ph) * 0.95;
      w.group.rotation.y = Math.cos(ph) > 0 ? Math.PI / 2 : -Math.PI / 2;
      w.animate(live + i, 0.016 * (still ? 0 : 1));
    });

    const thin = ease.inOut(seg(t, 13.1, 13.9));
    crowd.forEach((p, i) => {
      p.group.scale.setScalar(KEEP_AT_END.has(i) ? 1 : Math.max(0.0001, 1 - thin));
    });

    const showT = seg(t, 11.5, 12.3);
    const pressT = pulse(t, 12.65, 13.0, 0.1);
    const doneT = seg(t, 12.95, 13.35);
    if (showT !== tabletState.show || pressT !== tabletState.press || doneT !== tabletState.done) {
      const key = [showT, pressT, doneT].map((v) => Math.round(v * 30)).join();
      if (key !== tabletState.key) {
        tabletState.key = key;
        paintTablet(desk.g, 800, 576, { show: showT, press: pressT, done: doneT });
        desk.tex.needsUpdate = true;
      }
      Object.assign(tabletState, { show: showT, press: pressT, done: doneT });
    }
    const ringK = seg(t, 12.7, 13.2);
    desk.tapRing.material.opacity = ringK > 0 && ringK < 1 ? 0.8 * (1 - ringK) : 0;
    desk.tapRing.scale.setScalar(1 + ringK * 2.4);

    const nAppear = seg(t, 5.9, 6.4);
    const nLeave = seg(t, 8.0, 8.5);
    const nScale = Math.max(0.001, ease.outBack(nAppear) * (1 - ease.in(nLeave)));
    needs.group.visible = nAppear > 0 && nLeave < 1;
    needs.group.scale.setScalar(nScale);
    faceCard(needs, NEEDS_AT, 4, live, (1 - ease.out(nAppear)) * 0.2);
    needs.update({ title: seg(t, 6.0, 6.5), tasks: [seg(t, 6.3, 6.6), seg(t, 6.6, 6.9), seg(t, 6.9, 7.2)], chips: seg(t, 7.2, 7.8) });

    const eAppear = seg(t, 8.8, 9.3);
    const eLeave = seg(t, 11.3, 11.8);
    const eScale = Math.max(0.001, ease.outBack(eAppear) * (1 - ease.in(eLeave)));
    evidence.group.visible = eAppear > 0 && eLeave < 1;
    evidence.group.scale.setScalar(eScale);
    faceCard(evidence, EVID_AT, 6, live, (1 - ease.out(eAppear)) * 0.2);
    evidence.update({ type: seg(t, 9.4, 10.9), foot: seg(t, 10.9, 11.2) });

    const g = ease.inOut(seg(t, 13.05, 13.7));
    arc.visible = g > 0.001;
    arc.geometry.setDrawRange(0, Math.floor((g * arcCount) / 3) * 3);
    spark.visible = g > 0.01 && g < 0.999;
    if (spark.visible) spark.position.copy(arcPts.getPoint(g));

    stage.render();

    const sp = (v3, out) => Object.assign(out, stage.project(v3));
    sp(a3.set(-0.45, 2.2, -3.0), anchors.stack);
    sp(a3.set(maria.group.position.x, 1.75, maria.group.position.z), anchors.maria);
    sp(a3.set(ahmed.group.position.x, 1.75, ahmed.group.position.z), anchors.ahmed);
    sp(a3.set(elina.group.position.x, 1.75, elina.group.position.z), anchors.elina);
    sp(a3.copy(NEEDS_AT), anchors.needs);
    sp(a3.set(-3.4, 1.2, 0.5), anchors.tablet);
  }

  return { update, anchors, dispose: () => stage.dispose() };
}
