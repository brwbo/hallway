import * as THREE from "three";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";
import { clamp, lerp, tok } from "./util.js";

const BASE_ASPECT = 16 / 9;

export function createStage(canvas, { maxDpr = 2, shadows = true, shadowSize = 2048, fog = [14, 34], extent = 8, baseAspect = BASE_ASPECT, adaptNarrow = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(new THREE.Color(tok("--color-paper")), 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(tok("--color-paper")), fog[0], fog[1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.42;

  const camera = new THREE.PerspectiveCamera(30, baseAspect, 0.05, 80);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(new THREE.Color(tok("--color-paper-2")), new THREE.Color(tok("--c-oat")), 1.2));
  const key = new THREE.DirectionalLight(new THREE.Color(tok("--color-paper-2")), 2.4);
  key.castShadow = shadows;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.5, far: 36 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 5;
  key.position.set(-5, 11, 8);
  key.target.position.set(0, 0, -1);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(new THREE.Color(tok("--c-sage-soft")), 0.8);
  rim.position.set(6, 5, -6);
  scene.add(rim);

  const size = { w: 1, h: 1 };
  let shotFov = 30;

  const applyFov = () => {
    const a = size.w / size.h;
    let tanV = Math.tan(THREE.MathUtils.degToRad(shotFov) / 2);
    if (adaptNarrow && a < baseAspect) {
      const crop = lerp(1, 0.62, clamp((baseAspect - a) / (baseAspect - 0.46)));
      tanV = Math.min(tanV * (baseAspect / a) * crop, Math.tan(THREE.MathUtils.degToRad(46)));
    }
    camera.fov = THREE.MathUtils.radToDeg(Math.atan(tanV) * 2);
    camera.aspect = a;
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    size.w = Math.max(1, Math.round(rect.width));
    size.h = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(size.w, size.h, false);
    applyFov();
  };

  const setShot = (pos, look, fov) => {
    camera.position.copy(pos);
    camera.lookAt(look);
    shotFov = fov;
    applyFov();
    camera.updateMatrixWorld(true);
  };

  const v = new THREE.Vector3();
  const project = (world) => {
    v.copy(world).project(camera);
    return { x: (v.x * 0.5 + 0.5) * size.w, y: (-v.y * 0.5 + 0.5) * size.h, behind: v.z > 1 };
  };

  const dispose = () => {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };

  resize();
  return { THREE, renderer, scene, camera, key, rim, size, resize, setShot, project, dispose, render: () => renderer.render(scene, camera) };
}
