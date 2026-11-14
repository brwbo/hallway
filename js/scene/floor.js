import * as THREE from "three";
import { createStage } from "./stage.js";
import { BOOTH_COLORS, BOOTH_ICONS, buildBooth, buildHall, buildPlant } from "./props.js";
import { buildPerson, clearCaches, crowdLook } from "./people.js";
import { clamp, ease, hash, tok } from "./util.js";

const HALL_W = 14.6;
const HALL_D = 9.6;
const BOOTH_Z = -3.4;
const SPACING = 2.5;
const CAND_SCALE = 0.62;
const ARC_DOTS = 22;
const STYLE_ID = "hw-floor-style";

const CSS = `.hw-floor-chip{position:absolute;left:0;top:0;z-index:5;pointer-events:none;padding:.35em .8em;border-radius:999px;font:600 .8125rem/1.2 var(--font-body,system-ui,sans-serif);white-space:nowrap;opacity:0;background:var(--color-paper-2,Canvas);color:var(--color-ink,CanvasText);box-shadow:var(--shadow-card,0 4px 14px rgb(0 0 0 / .18));will-change:transform,opacity}.hw-floor-chip[data-kind="company"]{background:var(--color-accent,CanvasText);color:var(--color-accent-ink,Canvas)}`;

function noop() {
  const none = () => {};
  return { failed: true, focusCompany: none, focusCandidate: none, connect: none, clearConnections: none, setSuggestions: none, on: () => none, resize: none, destroy: none };
}

function shortName(name = "") {
  return String(name).replace(/\s+(Oy|Oyj|Ab|Ltd|Inc|GmbH)\.?$/i, "").slice(0, 26);
}

export async function mountFloor(canvasEl, { companies = [], candidates = [], reduced = false } = {}) {
  const parent = canvasEl.parentElement;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  try {
    await Promise.all(["400 40px 'Young Serif'", "400 20px 'Hanken Grotesk'"].map((f) => document.fonts.load(f).catch(() => null)));
  } catch (e) {
    void e;
  }

  let stage;
  try {
    stage = createStage(canvasEl, { maxDpr: 1.5, shadows: false, extent: 9, fog: [24, 50], baseAspect: 1.5 });
  } catch (err) {
    return noop();
  }
  const { scene, camera } = stage;
  scene.add(buildHall({ w: HALL_W, d: HALL_D }));
  [[-6.4, -4.1], [6.4, -4.1], [-6.5, 3.7], [6.5, 3.7]].forEach(([x, z]) => {
    const p = buildPlant(1);
    p.position.set(x, 0, z);
    scene.add(p);
  });

  const listeners = {};
  const emit = (name, payload) => (listeners[name] || []).slice().forEach((cb) => cb(payload));
  const on = (name, cb) => {
    (listeners[name] ||= []).push(cb);
    return () => {
      listeners[name] = listeners[name].filter((f) => f !== cb);
    };
  };

  const pickables = [];
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const addProxy = (geo, parentObj, pos, data) => {
    const m = new THREE.Mesh(geo, proxyMat);
    m.position.copy(pos);
    m.userData.pick = data;
    parentObj.add(m);
    pickables.push(m);
  };

  const count = Math.max(5, companies.length);
  const booths = new Map();
  const boothProxy = new THREE.BoxGeometry(1.9, 2.8, 1.2);
  companies.forEach((c, i) => {
    const slot = Number.isInteger(c.slot) ? c.slot : i;
    const x = (slot - (count - 1) / 2) * SPACING;
    const b = buildBooth({ color: BOOTH_COLORS[slot % 5], icon: BOOTH_ICONS[slot % 5], label: shortName(c.name), glow: true });
    b.group.position.set(x, 0, BOOTH_Z);
    scene.add(b.group);
    const staff = buildPerson({ ...crowdLook(slot + 20), cast: false, low: true, scale: 0.82 });
    staff.group.position.set(x + 1.25, 0, BOOTH_Z + 0.55);
    staff.group.rotation.y = -0.2;
    scene.add(staff.group);
    addProxy(boothProxy, b.group, new THREE.Vector3(0, 1.4, 0.2), { type: "company", id: c.id });
    booths.set(c.id, { id: c.id, name: c.name, x, b, staff, slot, links: 0 });
  });

  const people = new Map();
  const personProxy = new THREE.SphereGeometry(0.6, 8, 6);
  const shadowTex = new THREE.CanvasTexture(Object.assign(document.createElement("canvas"), { width: 64, height: 64 }));
  {
    const g = shadowTex.image.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, "rgba(72,58,30,0.45)");
    grad.addColorStop(1, "rgba(72,58,30,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    shadowTex.needsUpdate = true;
  }
  const blobMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(0.7, 0.7);
  const rnd = (seed) => {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  };
  const randSpot = (r) => ({ x: (r() - 0.5) * (HALL_W - 2.6), z: -1.2 + r() * 4.6 });

  candidates.forEach((c, i) => {
    const h = hash(String(c.id));
    const r = rnd(h);
    const p = buildPerson({ ...crowdLook(h % 997), cast: false, low: true, scale: CAND_SCALE });
    const spot = randSpot(r);
    p.group.position.set(spot.x, 0, spot.z);
    p.group.rotation.y = (r() - 0.5) * 6;
    scene.add(p.group);
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(spot.x, 0.015, spot.z);
    scene.add(blob);
    addProxy(personProxy, p.group, new THREE.Vector3(0, 0.75, 0), { type: "candidate", id: c.id });
    people.set(c.id, { id: c.id, name: c.name, p, blob, r, target: spot, wait: r() * 3, yaw: p.group.rotation.y, mode: "wander", dest: null, wave: 0, idx: i });
  });

  const ringMat = new THREE.MeshBasicMaterial({ color: tok("--color-accent"), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const personRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 32), ringMat);
  personRing.rotation.x = -Math.PI / 2;
  personRing.position.y = 0.03;
  personRing.visible = false;
  scene.add(personRing);

  const makeChip = () => {
    const el = document.createElement("div");
    el.className = "hw-floor-chip";
    el.setAttribute("aria-hidden", "true");
    parent.appendChild(el);
    return el;
  };
  const chips = { focus: makeChip(), hover: makeChip() };

  const state = { focus: null, hover: null, suggestions: [], connections: [] };
  const arcMat = new THREE.MeshBasicMaterial({ color: tok("--c-moss"), transparent: true, opacity: 0.75 });
  const dotGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const lineMat = new THREE.MeshStandardMaterial({ color: tok("--c-moss"), roughness: 0.6 });

  const q = new THREE.Vector3();
  const a3 = new THREE.Vector3();
  const b3 = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const sc = new THREE.Vector3();

  const boothAnchor = (bo, out) => out.set(bo.x, 2.2, BOOTH_Z + 0.9);
  const personAnchor = (pe, out) => out.set(pe.p.group.position.x, 0.95, pe.p.group.position.z);
  const curve = (A, B) => new THREE.QuadraticBezierCurve3(A.clone(), new THREE.Vector3((A.x + B.x) / 2, Math.max(A.y, B.y) + 1.1 + A.distanceTo(B) * 0.2, (A.z + B.z) / 2), B.clone());

  function setSuggestions(list = []) {
    state.suggestions.forEach((s) => {
      scene.remove(s.mesh);
      s.mesh.dispose();
    });
    state.suggestions = [];
    list.forEach((it) => {
      const cid = it.companyId ?? it.company_id ?? it.company;
      const pid = it.candidateId ?? it.candidate_id ?? it.candidate;
      if (!booths.has(cid) || !people.has(pid)) return;
      const mesh = new THREE.InstancedMesh(dotGeo, arcMat, ARC_DOTS);
      mesh.frustumCulled = false;
      scene.add(mesh);
      state.suggestions.push({ cid, pid, mesh });
    });
    invalidate();
  }

  function dropLine(c) {
    if (c.line) {
      scene.remove(c.line);
      c.line.geometry.dispose();
      c.line = null;
    }
  }

  function connect(companyId, candidateId) {
    const bo = booths.get(companyId);
    const pe = people.get(candidateId);
    if (!bo || !pe) return;
    const s = state.suggestions.findIndex((x) => x.cid === companyId && x.pid === candidateId);
    if (s >= 0) {
      scene.remove(state.suggestions[s].mesh);
      state.suggestions[s].mesh.dispose();
      state.suggestions.splice(s, 1);
    }
    if (state.connections.some((c) => c.cid === companyId && c.pid === candidateId)) return;
    const n = bo.links++;
    const dx = ((n % 3) - 1) * 0.55;
    pe.mode = "go";
    pe.dest = { x: bo.x - 0.2 + dx, z: BOOTH_Z + 1.5 + Math.floor(n / 3) * 0.6 };
    if (reduced) {
      pe.p.group.position.set(pe.dest.x, 0, pe.dest.z);
      pe.mode = "stay";
    }
    state.connections.push({ cid: companyId, pid: candidateId, grow: reduced ? 1 : 0, line: null, key: "" });
    emit("connect", { companyId, candidateId });
    invalidate();
  }

  function clearConnections() {
    state.connections.forEach((c) => {
      dropLine(c);
      const pe = people.get(c.pid);
      const bo = booths.get(c.cid);
      if (pe) {
        pe.mode = "wander";
        pe.wave = 0;
        pe.p.wave = 0;
        pe.target = randSpot(pe.r);
      }
      if (bo) {
        bo.links = 0;
        bo.staff.wave = 0;
      }
    });
    state.connections = [];
    invalidate();
  }

  function setFocus(kind, id) {
    state.focus = id ? { kind, id } : null;
    invalidate();
  }

  const entity = (e) => (e ? (e.kind === "company" ? booths.get(e.id) : people.get(e.id)) : null);

  function placeChip(el, e) {
    const ent = entity(e);
    if (!ent) {
      el.style.opacity = "0";
      return;
    }
    if (e.kind === "company") boothAnchor(ent, q).set(ent.x, 3.0, BOOTH_Z);
    else q.set(ent.p.group.position.x, 1.3, ent.p.group.position.z);
    const pt = stage.project(q);
    el.dataset.kind = e.kind;
    if (el.textContent !== ent.name) el.textContent = ent.name;
    el.style.opacity = "1";
    el.style.transform = `translate3d(${clamp(pt.x, 10, stage.size.w - 10).toFixed(1)}px, ${Math.max(pt.y, 34).toFixed(1)}px, 0) translate(-50%, -120%)`;
  }

  const view = { x: 0, z: 0, zoom: 1, tx: 0, tz: 0, tzoom: 1 };
  const base = { pos: new THREE.Vector3(0, 12.5, 15.5), look: new THREE.Vector3(0, 0.3, 0.0), fov: 34 };
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();

  function updateCamera(dt, t) {
    let tx = 0;
    let tz = 0;
    let tzoom = 1;
    const f = entity(state.focus);
    if (f) {
      if (state.focus.kind === "company") {
        tx = f.x * 0.55;
        tz = -1.2;
      } else {
        tx = f.p.group.position.x * 0.5;
        tz = f.p.group.position.z * 0.4 - 0.4;
      }
      tzoom = 0.85;
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3);
    view.x += (tx - view.x) * k;
    view.z += (tz - view.z) * k;
    view.zoom += (tzoom - view.zoom) * k;
    look.set(base.look.x + view.x, base.look.y, base.look.z + view.z);
    pos.set(base.pos.x + view.x + Math.sin(t * 0.2) * (reduced ? 0 : 0.25), base.pos.y, base.pos.z + view.z);
    pos.sub(look).multiplyScalar(view.zoom).add(look);
    stage.setShot(pos, look, base.fov);
    return Math.abs(tx - view.x) + Math.abs(tz - view.z) + Math.abs(tzoom - view.zoom) > 0.002;
  }

  function updatePeople(dt, t) {
    people.forEach((pe) => {
      const g = pe.p.group;
      let moving = false;
      if (!reduced && pe.mode !== "stay") {
        let goal = pe.mode === "go" ? pe.dest : pe.target;
        if (pe.mode === "wander" && pe.wait > 0) {
          pe.wait -= dt;
          goal = null;
        }
        if (goal) {
          const dx = goal.x - g.position.x;
          const dz = goal.z - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.08) {
            if (pe.mode === "go") pe.mode = "stay";
            else {
              pe.target = randSpot(pe.r);
              pe.wait = 1 + pe.r() * 4;
            }
          } else {
            const sp = (pe.mode === "go" ? 1.1 : 0.3 + (pe.idx % 4) * 0.05) * dt;
            g.position.x += (dx / dist) * Math.min(sp, dist);
            g.position.z += (dz / dist) * Math.min(sp, dist);
            pe.yaw = Math.atan2(dx, dz);
            moving = true;
          }
        }
      }
      if (pe.mode === "stay") {
        const bo = [...booths.values()].find((b) => state.connections.some((c) => c.pid === pe.id && c.cid === b.id));
        if (bo) pe.yaw = bo.x >= g.position.x ? 1.0 : -1.0;
      }
      let dy = pe.yaw - g.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      g.rotation.y += dy * (reduced ? 1 : 1 - Math.exp(-dt * 6));
      pe.p.walk = moving ? 0.9 : 0;
      pe.wave = pe.mode === "stay" && state.connections.some((c) => c.pid === pe.id) ? 1 : 0;
      pe.p.wave = pe.wave;
      pe.p.animate(t + pe.idx, dt);
      pe.blob.position.x = g.position.x;
      pe.blob.position.z = g.position.z;
    });
    booths.forEach((bo) => {
      const linked = state.connections.some((c) => c.cid === bo.id && people.get(c.pid)?.mode === "stay");
      bo.staff.wave = linked ? 1 : 0;
      bo.staff.animate(t + bo.slot, dt);
      const focused = state.focus?.kind === "company" && state.focus.id === bo.id;
      const hovered = state.hover?.kind === "company" && state.hover.id === bo.id;
      if (bo.b.ring) bo.b.ring.material.opacity += ((focused ? 0.85 : hovered ? 0.5 : 0) - bo.b.ring.material.opacity) * (reduced ? 1 : 0.2);
    });
  }

  function updateLinks(t) {
    state.suggestions.forEach((s) => {
      const bo = booths.get(s.cid);
      const pe = people.get(s.pid);
      boothAnchor(bo, a3).set(bo.x, 1.5, BOOTH_Z + 1.0);
      personAnchor(pe, b3);
      const c = curve(a3, b3);
      for (let i = 0; i < ARC_DOTS; i++) {
        const u = ((i / ARC_DOTS) + (reduced ? 0 : t * 0.12)) % 1;
        c.getPoint(u, q);
        const edge = Math.min(u, 1 - u) * 5;
        sc.setScalar(clamp(edge, 0.25, 1));
        m4.compose(q, quat, sc);
        s.mesh.setMatrixAt(i, m4);
      }
      s.mesh.instanceMatrix.needsUpdate = true;
    });
    state.connections.forEach((cn) => {
      const bo = booths.get(cn.cid);
      const pe = people.get(cn.pid);
      cn.grow = Math.min(1, cn.grow + (reduced ? 1 : 0.02));
      const arrived = pe.mode === "stay";
      boothAnchor(bo, a3).set(bo.x, 1.5, BOOTH_Z + 1.0);
      personAnchor(pe, b3);
      const key = [a3.x, b3.x, b3.z, cn.grow, arrived].map((v) => (typeof v === "number" ? v.toFixed(2) : v)).join();
      if (key === cn.key) return;
      cn.key = key;
      dropLine(cn);
      const c = curve(a3, b3);
      const geo = new THREE.TubeGeometry(c, 28, 0.04, 6, false);
      geo.setDrawRange(0, Math.floor((ease.inOut(cn.grow) * geo.index.count) / 3) * 3);
      cn.line = new THREE.Mesh(geo, lineMat);
      scene.add(cn.line);
    });
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointer = null;
  function pickAt(clientX, clientY) {
    const r = canvasEl.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.pick : null;
  }

  const onMove = (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    invalidate();
  };
  const onLeave = () => {
    pointer = null;
    state.hover = null;
    canvasEl.style.cursor = "";
    invalidate();
  };
  const onClick = (e) => {
    const p = pickAt(e.clientX, e.clientY);
    if (p) emit("select", { type: p.type, id: p.id });
  };
  canvasEl.addEventListener("pointermove", onMove, { passive: true });
  canvasEl.addEventListener("pointerleave", onLeave);
  canvasEl.addEventListener("click", onClick);

  let raf = 0;
  let visible = true;
  let last = 0;
  let clock = 0;
  let dirty = true;
  let destroyed = false;

  function frame(now) {
    raf = 0;
    if (destroyed || !visible || document.hidden) return;
    const elapsed = now - last;
    if (!reduced && elapsed < 30) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(elapsed / 1000, 0.1);
    last = now;
    clock += dt;
    if (pointer) {
      const p = pickAt(pointer.x, pointer.y);
      const next = p ? { kind: p.type, id: p.id } : null;
      if (JSON.stringify(next) !== JSON.stringify(state.hover)) {
        state.hover = next;
        canvasEl.style.cursor = p ? "pointer" : "";
      }
    }
    const moving = updateCamera(dt, clock);
    updatePeople(dt, clock);
    updateLinks(clock);

    const fe = entity(state.focus);
    personRing.visible = !!(fe && state.focus.kind === "candidate");
    if (personRing.visible) {
      personRing.position.x = fe.p.group.position.x;
      personRing.position.z = fe.p.group.position.z;
      personRing.scale.setScalar(1 + Math.sin(clock * 4) * 0.05);
    }
    stage.render();
    placeChip(chips.focus, state.focus);
    const hv = state.hover && !(state.focus && state.hover.id === state.focus.id) ? state.hover : null;
    placeChip(chips.hover, hv);

    dirty = false;
    if (!reduced || moving || pointer) raf = requestAnimationFrame(frame);
  }

  function invalidate() {
    dirty = true;
    if (!raf && visible && !document.hidden && !destroyed) {
      raf = requestAnimationFrame((n) => {
        last = n - 100;
        frame(n);
      });
    }
  }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate();
  });
  io.observe(canvasEl);
  const onVis = () => invalidate();
  document.addEventListener("visibilitychange", onVis);
  const ro = new ResizeObserver(() => {
    stage.resize();
    invalidate();
  });
  ro.observe(parent);

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    canvasEl.removeEventListener("pointermove", onMove);
    canvasEl.removeEventListener("pointerleave", onLeave);
    canvasEl.removeEventListener("click", onClick);
    chips.focus.remove();
    chips.hover.remove();
    state.connections.forEach(dropLine);
    stage.dispose();
    shadowTex.dispose();
    clearCaches();
    Object.keys(listeners).forEach((k) => delete listeners[k]);
  }

  invalidate();
  return {
    failed: false,
    focusCompany: (id) => setFocus("company", id),
    focusCandidate: (id) => setFocus("candidate", id),
    connect,
    clearConnections,
    setSuggestions,
    on,
    resize: () => {
      stage.resize();
      invalidate();
    },
    destroy,
  };
}
