import { clamp, ease, lerp, pulse, seg } from "./util.js";
import { END } from "./filmworld.js";

const SPEECH = [
  { a: 2.3, b: 3.9, text: "“Motivated team player with strong communication skills.”", anchor: "stack", dx: 1, dy: -10 },
  { a: 4.9, b: 6.3, text: "“We need a cybersecurity person.”", anchor: "maria", dx: -1, dy: -44, to: "needs", melt: [5.75, 6.3] },
];

const TAGS = [
  { anchor: "maria", windows: [[4.6, 7.9], [13.3, END + 2]] },
  { anchor: "ahmed", windows: [[8.6, 11.3], [13.3, END + 2]] },
  { anchor: "elina", windows: [[11.7, 13.2]] },
];

export function createOverlay({ speech, tags, hero, beats, rail }) {
  const items = beats.map((li) => ({ el: li, a: Number(li.dataset.in), b: Number(li.dataset.out) }));
  const ticks = rail ? [...rail.children] : [];
  let active = -2;
  let speechIndex = -1;

  const place = (el, a, x, y, extra = "") => {
    el.style.opacity = a.toFixed(3);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${extra}`;
  };

  function update(t, anchors, size) {
    let current = -1;
    items.forEach((b, i) => {
      const a = pulse(t, b.a, b.b, 0.28);
      const rise = 1 - ease.outExpo(seg(t, b.a, b.a + 0.5));
      b.el.style.opacity = a.toFixed(3);
      b.el.style.transform = `translate3d(0, ${(rise * 22).toFixed(1)}px, 0)`;
      b.el.style.filter = a < 0.99 ? `blur(${((1 - a) * 5).toFixed(2)}px)` : "none";
      b.el.style.visibility = a > 0.005 ? "visible" : "hidden";
      if (a > 0.5) current = i;
    });
    if (current !== active) {
      active = current;
      ticks.forEach((el, i) => el.classList.toggle("is-on", i === current));
    }
    if (rail) rail.style.opacity = clamp(seg(t, 1.4, 1.9)).toFixed(3);

    const out = seg(t, 1.0, 1.5);
    hero.style.opacity = (1 - out).toFixed(3);
    hero.style.transform = `translate3d(0, ${(-out * 28).toFixed(1)}px, 0)`;
    hero.style.visibility = out < 1 ? "visible" : "hidden";

    const sIdx = SPEECH.findIndex((s) => t >= s.a - 0.05 && t <= s.b);
    if (sIdx !== speechIndex) {
      speechIndex = sIdx;
      if (sIdx >= 0) speech.textContent = SPEECH[sIdx].text;
    }
    if (sIdx < 0) speech.style.opacity = "0";
    else {
      const s = SPEECH[sIdx];
      const A = anchors[s.anchor];
      let a = pulse(t, s.a, s.b, 0.22);
      let x = A.x;
      let y = A.y;
      let scale = 0.86 + 0.14 * ease.outBack(seg(t, s.a, s.a + 0.35));
      if (s.melt) {
        const m = ease.inOut(seg(t, s.melt[0], s.melt[1]));
        const T = anchors[s.to];
        x = lerp(A.x, T.x, m);
        y = lerp(A.y, T.y, m);
        scale *= 1 - 0.7 * m;
        a = Math.min(a, 1 - seg(t, s.melt[0] + 0.25, s.melt[1]));
        speech.style.filter = m > 0.01 ? `blur(${(m * 4).toFixed(1)}px)` : "none";
      } else speech.style.filter = "none";
      const w = speech.offsetWidth;
      const px = clamp(x + s.dx * 12 + (s.dx > 0 ? w * 0.5 : -w * 0.5), w / 2 + 10, size.w - w / 2 - 10);
      speech.style.transformOrigin = "50% 100%";
      place(speech, a, px, y + s.dy, "translate(-50%, -100%) scale(" + scale.toFixed(3) + ")");
    }

    tags.forEach((el, i) => {
      const d = TAGS[i];
      const a = Math.max(...d.windows.map(([x, y]) => pulse(t, x, y, 0.25)));
      const A = anchors[d.anchor];
      const hw = el.offsetWidth / 2 + 8;
      place(el, clamp(a), clamp(A.x, hw, size.w - hw), A.y, "translate(-50%, -100%)");
    });
  }

  return { update };
}
