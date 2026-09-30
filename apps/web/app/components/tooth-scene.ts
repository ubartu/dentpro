import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { quadrants, toothName, type Dentition } from "./dentition";

/** Procedural selection model, not patient-specific anatomy. FDI right = patient's right. */
export function createToothScene(
  host: HTMLDivElement,
  mode: Dentition,
  choose: (code: string) => void,
  unavailable: () => void,
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf3f7fb, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `${mode === "adult" ? "Yetişkin" : "Çocuk"} 3B dişleri. Atamak için dişe tıklayın, döndürmek için sürükleyin. Aşağıdaki numaralı düğmeler klavyeyle seçime olanak verir.`,
  );
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 5.6, -5.6, 0.1, 100);
  camera.position.set(0, 16, 7);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false; // Explicit zoom buttons avoid trapping page scrolling.
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = 0.9;
  controls.minAzimuthAngle = -0.65;
  controls.maxAzimuthAngle = 0.65;
  controls.rotateSpeed = 0.7;
  controls.update();
  controls.saveState();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d91a8, 1.4));
  const key = new THREE.DirectionalLight(0xfff9ee, 2.2);
  key.position.set(-4, 10, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd6eaff, 0.8);
  fill.position.set(5, 7, -4);
  scene.add(fill);
  const groups: THREE.Group[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const textures: THREE.Texture[] = [];
  const gumMaterial = new THREE.MeshStandardMaterial({
    color: 0xd98599,
    roughness: 0.65,
  });
  const ivory = 0xeee6d9;
  const scale = mode === "adult" ? 1 : 0.7;
  function label(
    text: string,
    x: number,
    y: number,
    z: number,
    width = 0.55,
    color = "#465c76",
  ) {
    const bitmap = document.createElement("canvas");
    bitmap.width = 256;
    bitmap.height = 64;
    const ctx = bitmap.getContext("2d")!;
    ctx.font = /^\d+$/.test(text) ? "600 44px Arial" : "600 26px Arial";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(bitmap);
    textures.push(texture);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        toneMapped: false,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(width, width / 4, 1);
    scene.add(sprite);
  }
  for (const upper of [true, false]) {
    const sign = upper ? -1 : 1;
    const points = Array.from({ length: 65 }, (_, i) => {
      const angle = -1.6 + (i / 64) * 3.2;
      return new THREE.Vector3(
        2.9 * Math.sin(angle) * scale,
        0,
        sign * (0.8 + 3.5 * Math.cos(angle)) * scale,
      );
    });
    const gum = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        96,
        0.42 * scale,
        12,
        false,
      ),
      gumMaterial,
    );
    scene.add(gum);
    label(
      upper ? "UPPER ARCH" : "LOWER ARCH",
      0,
      0.1,
      sign * 2.6 * scale,
      2.7,
      "#7e6271",
    );
  }
  for (const q of quadrants(mode)) {
    for (const [index, code] of q.teeth.entries()) {
      const n = index + 1;
      const angle = ((index + 0.5) / q.teeth.length) * 1.6;
      const side = q.right ? -1 : 1;
      const sign = q.upper ? -1 : 1;
      const x = side * 2.9 * Math.sin(angle) * scale;
      const z = sign * (0.8 + 3.5 * Math.cos(angle)) * scale;
      const tooth = new THREE.Group();
      tooth.userData.tooth = code;
      tooth.position.set(x, 0, z);
      tooth.rotation.y = -side * sign * angle;
      const molar = mode === "child" ? n >= 4 : n >= 6;
      const premolar = mode === "adult" && n >= 4 && n <= 5;
      const width = molar ? 0.73 : premolar ? 0.62 : n === 2 ? 0.49 : 0.57;
      const depth = molar ? 0.84 : premolar ? 0.67 : 0.47;
      const mat = new THREE.MeshStandardMaterial({
        color: ivory,
        roughness: 0.28,
        metalness: 0,
      });
      materials.set(code, mat);
      const crown = new THREE.Mesh(
        new RoundedBoxGeometry(width, 0.67, depth, 3, 0.16),
        mat,
      );
      crown.position.y = 0.43;
      tooth.add(crown);
      // Occlusal cusps distinguish molars/premolars from flat incisors and pointed canines.
      const cusps = molar
        ? [
            [-0.19, -0.22],
            [0.19, -0.22],
            [-0.19, 0.22],
            [0.19, 0.22],
          ]
        : premolar
          ? [
              [0, -0.17],
              [0, 0.17],
            ]
          : n === 3
            ? [[0, 0]]
            : [];
      for (const [cx, cz] of cusps) {
        const cusp = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), mat);
        cusp.scale.set(1, n === 3 ? 1.3 : 0.6, 1);
        cusp.position.set(cx, 0.76, cz);
        tooth.add(cusp);
      }
      for (const rx of molar ? [-0.17, 0.17] : [0]) {
        const root = new THREE.Mesh(
          new THREE.ConeGeometry(0.17, 0.65, 12),
          mat,
        );
        root.rotation.z = Math.PI;
        root.position.set(rx, -0.35, 0);
        tooth.add(root);
      }
      scene.add(tooth);
      groups.push(tooth);
      label(
        code,
        x + side * 0.67 * Math.sin(angle),
        0.45,
        z + sign * 0.7 * Math.cos(angle),
        1.6,
      );
    }
  }
  label("HASTANIN SAĞI", -2.7, 0.1, 0, 2.3);
  label("HASTANIN SOLU", 2.7, 0.1, 0, 2.3);
  function render() {
    renderer.render(scene, camera);
  }
  function resize() {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(5.6, 4.6 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  const ray = new THREE.Raycaster();
  function pick(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    let object: THREE.Object3D | undefined = ray.intersectObjects(
      groups,
      true,
    )[0]?.object;
    while (object && !object.userData.tooth)
      object = object.parent ?? undefined;
    return object?.userData.tooth as string | undefined;
  }
  let down: { x: number; y: number; id: number } | null = null;
  let dragged = false;
  function pointerDown(e: PointerEvent) {
    if (down) {
      dragged = true;
      return;
    }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged = false;
  }
  function pointerMove(e: PointerEvent) {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6)
      dragged = true;
    const code = pick(e);
    canvas.style.cursor = down ? "grabbing" : code ? "pointer" : "grab";
    canvas.title = code
      ? `FDI ${code} · ${toothName(code)}`
      : "Döndürmek için sürükleyin";
  }
  function pointerUp(e: PointerEvent) {
    if (down?.id === e.pointerId && !dragged && e.button === 0) {
      const code = pick(e);
      if (code) choose(code);
    }
    down = null;
  }
  function cancel() {
    down = null;
  }
  function contextLost(e: Event) {
    e.preventDefault();
    unavailable();
  }
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("webglcontextlost", contextLost);
  resize();
  return {
    select(selected: string, assigned: string[]) {
      for (const [code, mat] of materials) {
        const active = code === selected || selected === "ALL";
        mat.color.setHex(
          active
            ? 0x2878e4
            : assigned.includes(code) || assigned.includes("ALL")
              ? 0x59b5a6
              : ivory,
        );
        mat.emissive.setHex(active ? 0x082551 : 0x000000);
      }
      render();
    },
    reset() {
      controls.reset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      render();
    },
    zoom(delta: number) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom + delta, 0.8, 1.8);
      camera.updateProjectionMatrix();
      render();
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("webglcontextlost", contextLost);
      const geometries = new Set<THREE.BufferGeometry>();
      const usedMaterials = new Set<THREE.Material>();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) geometries.add(obj.geometry);
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          for (const mat of Array.isArray(obj.material)
            ? obj.material
            : [obj.material])
            usedMaterials.add(mat);
        }
      });
      geometries.forEach((g) => g.dispose());
      usedMaterials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
