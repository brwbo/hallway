import { clamp, ease, lerp, seg } from "./util.js";
import { createStage } from "./stage.js";
import { createFilmWorld, END } from "./filmworld.js";
import { createOverlay } from "./overlay.js";

const INTRO = 0.5;
const KEYS = [[0, INTRO], [40, 1.0], [85, 2.2], [150, 3.9], [185, 4.8], [260, 7.9], [290, 8.8], [360, 11.2], [395, 12.1], [455, 13.0], [510, 14.0], [560, END]];
const LENGTH = KEYS[KEYS.length - 1][0];
const STILLS = [3.4, 7.6, 10.9, 14.4];

function timeAt(y) {
  if (y <= 0) return KEYS[0][1];
  for (let i = 1; i < KEYS.length; i++) {
    if (y <= KEYS[i][0]) return lerp(KEYS[i - 1][1], KEYS[i][1], (y - KEYS[i - 1][0]) / (KEYS[i][0] - KEYS[i - 1][0]));
  }
  return KEYS[KEYS.length - 1][1];
}

export async function initFilm({ reduced }) {
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const wrap = $("film");
  const canvas = $("scene");
  const beats = [...document.querySelectorAll("#beats li")];
  await Promise.all(["400 80px 'Young Serif'", "400 40px 'Hanken Grotesk'", "600 40px 'Hanken Grotesk'", "500 70px Caveat"].map((f) => document.fonts.load(f).catch(() => null)));

  let stage;
  let world;
  try {
    root.classList.add(reduced ? "static" : "scrub");
    stage = createStage(canvas, { maxDpr: 2, shadowSize: 2048, extent: 9 });
    world = createFilmWorld(stage, { still: reduced });
  } catch (err) {
    root.classList.remove("scrub", "static");
    root.classList.add("nogl");
    return null;
  }

  const wide = () => stage.size.w / stage.size.h > 1.15;
  const heroX = () => clamp(0.3 + (1.6 - stage.size.w / stage.size.h) * 0.5, 0.3, 0.45);
  const shift = (hero) => (wide() ? { shiftX: hero ? heroX() : 0.13, shiftY: 0 } : { shiftX: 0, shiftY: hero ? 0.2 : -0.17 });
  const size = () => stage.size;

  if (reduced) {
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      stage.renderer.setPixelRatio(dpr);
      stage.renderer.setSize(720, 540, false);
      stage.size.w = 720;
      stage.size.h = 540;
      beats.forEach((li, i) => {
        const still = li.querySelector("canvas");
        if (!still) return;
        still.width = 720 * dpr;
        still.height = 540 * dpr;
        world.update(STILLS[i], { live: 2.4, px: 0, py: 0, shiftX: 0, shiftY: 0 });
        still.getContext("2d").drawImage(canvas, 0, 0, still.width, still.height);
      });
      stage.resize();
      world.update(0.9, { live: 2.4, px: 0, py: 0, ...shift(true) });
    };
    paint();
    let timer = 0;
    addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(paint, 150);
    });
    return { mode: "static" };
  }

  wrap.style.setProperty("--film-length", String(LENGTH));
  const overlay = createOverlay({ speech: $("chip-speech"), tags: [...document.querySelectorAll(".chip-tag")], hero: $("hero"), beats, rail: $("rail") });
  const view = { live: 0, px: 0, py: 0, shiftX: 0, shiftY: 0 };
  const pointer = { x: 0, y: 0 };
  const stats = { frames: 0, total: 0, worst: 0 };
  let intro = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let visible = true;
  let primed = false;

  const scrollY = () => (-wrap.getBoundingClientRect().top / window.innerHeight) * 100;

  function tick(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    stats.frames++;
    stats.total += dt;
    stats.worst = Math.max(stats.worst, dt);
    view.live += dt;
    intro = Math.min(INTRO, intro + dt);
    const y = clamp(scrollY(), 0, LENGTH);
    const target = timeAt(y) - (INTRO - intro) * (1 - clamp(y / 20));
    const damp = primed ? 1 - Math.exp(-dt * 9) : 1;
    primed = true;
    time += (target - time) * damp;
    view.px += (pointer.x - view.px) * (1 - Math.exp(-dt * 4));
    view.py += (pointer.y - view.py) * (1 - Math.exp(-dt * 4));
    const heroK = 1 - ease.inOut(seg(time, 1.0, 2.2));
    const s = shift(true);
    const b = shift(false);
    view.shiftX = lerp(b.shiftX, s.shiftX, heroK);
    view.shiftY = lerp(b.shiftY, s.shiftY, heroK);
    world.update(time, view);
    overlay.update(time, world.anchors, size());
    raf = requestAnimationFrame(tick);
  }

  function wake() {
    if (raf || !visible || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  }).observe(wrap);
  document.addEventListener("visibilitychange", wake);
  addEventListener("resize", () => stage.resize());
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  const jump = (vh) => window.scrollTo({ top: wrap.offsetTop + (vh / 100) * window.innerHeight, behavior: "smooth" });
  document.querySelectorAll('a[href="#how"]').forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    jump(60);
    history.replaceState(null, "", "#how");
  }));
  if (location.hash === "#how") jump(60);

  world.update(timeAt(clamp(scrollY(), 0, LENGTH)), { ...view, ...shift(true) });
  overlay.update(timeAt(clamp(scrollY(), 0, LENGTH)), world.anchors, size());
  wake();
  return { mode: "scrub", stats, running: () => !!raf, state: () => ({ time, y: scrollY() }) };
}
