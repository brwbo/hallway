import * as THREE from "three";
import { canvasTexture, clamp, tok, wrapText } from "./util.js";
import { softShadowTexture } from "./props.js";

const PXW = 640;
const PXH = 800;
export const CARD_W = 1.2;
export const CARD_H = 1.5;

function fonts() {
  return { display: tok("--font-display"), body: tok("--font-body"), hand: tok("--font-outlier") };
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function chip(g, text, x, y, f, bg, fg) {
  g.font = `600 24px ${f.body}`;
  const w = g.measureText(text).width + 34;
  g.fillStyle = bg;
  rr(g, x, y, w, 46, 23);
  g.fill();
  g.fillStyle = fg;
  g.textBaseline = "middle";
  g.fillText(text, x + 17, y + 24);
  g.textBaseline = "alphabetic";
  return w + 10;
}

function paintNeeds(g, s) {
  const f = fonts();
  const paper = tok("--color-paper-2");
  g.clearRect(0, 0, PXW, PXH);
  g.fillStyle = paper;
  rr(g, 0, 0, PXW, PXH, 44);
  g.fill();
  g.fillStyle = tok("--color-muted");
  g.font = `600 24px ${f.body}`;
  g.fillText("Needs card", 48, 68);
  g.fillStyle = tok("--color-ink");
  g.font = `400 46px ${f.display}`;
  g.fillText("Tuulia Software Oy", 48, 126);

  g.globalAlpha = 1 - 0.55 * s.tasks[0];
  g.fillStyle = tok("--color-muted");
  g.font = `400 30px ${f.body}`;
  const ask = "“a cybersecurity person”";
  g.fillText(ask, 48, 184);
  g.strokeStyle = tok("--c-clay");
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(44, 174);
  g.lineTo(44 + g.measureText(ask).width * clamp(s.title * 1.6), 174);
  g.stroke();
  g.globalAlpha = 1;

  g.fillStyle = tok("--color-ink-2");
  g.font = `600 26px ${f.body}`;
  g.globalAlpha = clamp(s.title * 2 - 0.4);
  g.fillText("What the work really is", 48, 250);
  g.globalAlpha = 1;

  const tasks = ["Watch the logins and spot odd activity", "Find weak spots in the payment code", "Write a plain plan for when something goes wrong"];
  tasks.forEach((t, i) => {
    const a = s.tasks[i];
    if (a <= 0.01) return;
    const y = 292 + i * 112;
    g.globalAlpha = a;
    g.fillStyle = tok("--c-moss");
    g.beginPath();
    g.arc(74, y + 28 - (1 - a) * 10, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = paper;
    g.font = `600 28px ${f.body}`;
    g.textAlign = "center";
    g.fillText(String(i + 1), 74, y + 38 - (1 - a) * 10);
    g.textAlign = "left";
    g.fillStyle = tok("--color-ink");
    g.font = `400 31px ${f.body}`;
    wrapText(g, t, 124, y + 22 - (1 - a) * 10, 452, 40, 3);
    g.globalAlpha = 1;
  });

  if (s.chips > 0.01) {
    g.globalAlpha = s.chips;
    g.fillStyle = tok("--color-muted");
    g.font = `600 22px ${f.body}`;
    g.fillText("ESCO skills", 48, 668);
    let x = 48;
    ["ICT security", "Incident handling", "Secure coding"].forEach((c, i) => {
      if (s.chips < 0.2 + i * 0.25) return;
      if (i === 2) x = 48;
      x += chip(g, c, x, i === 2 ? 738 : 684, f, tok("--c-sage-soft"), tok("--c-moss-deep"));
    });
    g.globalAlpha = 1;
  }
}

function paintEvidence(g, s) {
  const f = fonts();
  g.clearRect(0, 0, PXW, PXH);
  g.fillStyle = tok("--color-paper-2");
  rr(g, 0, 0, PXW, PXH, 44);
  g.fill();
  g.fillStyle = tok("--color-muted");
  g.font = `600 24px ${f.body}`;
  g.fillText("Evidence card", 48, 68);
  g.fillStyle = tok("--color-ink");
  g.font = `400 46px ${f.display}`;
  g.fillText("Ahmed Rahimi", 48, 126);
  g.fillStyle = tok("--color-ink-2");
  g.font = `400 26px ${f.body}`;
  g.fillText("Security graduate, moving to Finland", 48, 168);

  g.fillStyle = tok("--c-sage");
  g.fillRect(48, 210, 6, 96);
  g.fillStyle = tok("--color-ink-2");
  g.font = `400 27px ${f.body}`;
  wrapText(g, "If strange logins appeared at night, what would you check first?", 74, 238, 500, 36, 3);

  const words = "I would look at who logged in and from where. Then I would turn on a second step when people sign in. A small team can do that in a day.";
  const n = Math.round(words.length * s.type);
  g.fillStyle = tok("--color-ink");
  g.font = `500 41px ${f.hand}`;
  wrapText(g, words.slice(0, n), 48, 372, 544, 50, 8);

  if (s.foot > 0.01) {
    g.globalAlpha = s.foot;
    g.fillStyle = tok("--color-rule");
    g.fillRect(48, 662, 544, 2);
    g.fillStyle = tok("--c-moss");
    g.font = `600 26px ${f.body}`;
    g.fillText("In his own words. No score.", 48, 716);
    g.globalAlpha = 1;
  }
}

function makeCard(paint, init) {
  const { canvas, tex, g } = canvasTexture(THREE, PXW, PXH);
  const group = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
  face.renderOrder = 2;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.5, CARD_H * 1.4), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, opacity: 0.6, depthWrite: false }));
  shadow.position.set(0.06, -0.12, -0.02);
  shadow.renderOrder = 1;
  group.add(shadow, face);
  let last = "";
  const state = { ...init };
  function update(next) {
    Object.assign(state, next);
    const key = JSON.stringify(state, (_, v) => (typeof v === "number" ? Math.round(v * 40) : v));
    if (key === last) return;
    last = key;
    paint(g, state);
    tex.needsUpdate = true;
  }
  update({});
  return { group, update, face, shadow };
}

export const buildNeedsCard = () => makeCard(paintNeeds, { title: 0, tasks: [0, 0, 0], chips: 0 });
export const buildEvidenceCard = () => makeCard(paintEvidence, { type: 0, foot: 0 });

export function paintTablet(g, w, h, s) {
  const f = fonts();
  g.clearRect(0, 0, w, h);
  g.fillStyle = tok("--c-screen");
  g.fillRect(0, 0, w, h);
  g.fillStyle = tok("--color-paper-2");
  g.fillRect(0, 0, w, 78);
  g.fillStyle = tok("--color-ink");
  g.font = `400 34px ${f.display}`;
  g.textBaseline = "middle";
  g.fillText("Hallway", 36, 40);
  g.fillStyle = tok("--color-muted");
  g.font = `600 22px ${f.body}`;
  g.textAlign = "right";
  g.fillText("Espoo Tech Talent Day", w - 36, 40);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";

  g.globalAlpha = clamp(s.show * 2);
  const dy = (1 - clamp(s.show * 2)) * 14;
  g.fillStyle = tok("--color-muted");
  g.font = `600 22px ${f.body}`;
  g.fillText("Suggested conversation", 52, 142 + dy);
  g.fillStyle = tok("--color-ink");
  g.font = `400 62px ${f.display}`;
  g.fillText("Talk to Ahmed", 52, 214 + dy);
  g.fillStyle = tok("--color-ink-2");
  g.font = `400 27px ${f.body}`;
  wrapText(g, "Maria Lehtonen at Tuulia Software Oy needs help with security. Ahmed started with the practical first step.", 52, 270 + dy, 696, 36, 3);
  g.fillStyle = tok("--c-moss");
  g.font = `600 25px ${f.body}`;
  g.fillText("Ask him: what would you do on day one?", 52, 396 + dy);
  g.globalAlpha = 1;

  const done = s.done;
  const press = s.press;
  const by = 448;
  if (done < 0.5) {
    g.globalAlpha = clamp(s.show * 2 - 0.6) * (1 - done * 2);
    g.fillStyle = press > 0.3 ? tok("--color-focus") : tok("--c-moss");
    const sc = 1 - 0.04 * press;
    rr(g, 52 + (1 - sc) * 100, by + (1 - sc) * 30, 250 * sc, 80 * sc, 40);
    g.fill();
    g.fillStyle = tok("--color-paper-2");
    g.font = `600 32px ${f.body}`;
    g.textAlign = "center";
    g.fillText("Accept", 52 + 125, by + 52);
    g.fillStyle = tok("--color-paper-3");
    rr(g, 322, by, 190, 80, 40);
    g.fill();
    g.fillStyle = tok("--color-ink-2");
    g.fillText("Skip", 322 + 95, by + 52);
    g.textAlign = "left";
    g.globalAlpha = 1;
  }
  if (done > 0.01) {
    g.globalAlpha = clamp(done * 1.4);
    g.fillStyle = tok("--c-sage-soft");
    rr(g, 52, by, 696, 80, 40);
    g.fill();
    g.fillStyle = tok("--c-moss-deep");
    g.font = `600 30px ${f.body}`;
    g.fillText("Accepted by Elina. Maria and Ahmed can talk.", 92, by + 52);
    g.globalAlpha = 1;
  }
}
