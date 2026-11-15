"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { COLORS } from "@/lib/tokens";

type FireCell = { lat: number; lon: number; count: number };
type GlobeFires = { generatedAt: string; dateFrom: string; dateTo: string; cells: FireCell[] };

function pointOnGlobe(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Globo ligero: la textura y los focos son opcionales para que la portada funcione sin conexión. */
export default function Globe() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [period, setPeriod] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebgl(false);
      return;
    }

    setWebgl(true);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 5.4);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    scene.add(globe);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 8, specular: 0x163a58 });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1.38, 72, 72), material);
    globe.add(earth);
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1.405, 72, 72), new THREE.MeshBasicMaterial({ color: COLORS.brand500, transparent: true, opacity: 0.08 })));
    scene.add(new THREE.HemisphereLight(0xdff3ff, 0x011b39, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 2, 4);
    scene.add(key);

    let disposed = false;
    const texture = new THREE.TextureLoader();
    texture.load(
      "/textures/blue-marble.jpg",
      (loaded) => {
        if (disposed) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace;
        material.map = loaded;
        material.needsUpdate = true;
      },
      undefined,
      () => undefined,
    );

    fetch("/data/globe-fires.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Sin focos agregados"))))
      .then((data: GlobeFires) => {
        if (disposed) return;
        const positions = new Float32Array(data.cells.length * 3);
        const sizes = new Float32Array(data.cells.length);
        data.cells.forEach((cell, index) => {
          const point = pointOnGlobe(cell.lat, cell.lon, 1.415);
          positions.set([point.x, point.y, point.z], index * 3);
          sizes[index] = 3.8 + Math.min(9, Math.log1p(Math.max(cell.count, 0)) * 1.8);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
        const points = new THREE.Points(
          geometry,
          new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: { pointColor: { value: new THREE.Color(0xffa453) } },
            vertexShader: "attribute float size; void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * (1.8 / -mvPosition.z), 1.5, 6.0); gl_Position = projectionMatrix * mvPosition; }",
            fragmentShader: "uniform vec3 pointColor; void main() { float d = distance(gl_PointCoord, vec2(0.5)); if (d > 0.5) discard; gl_FragColor = vec4(pointColor, 1.0 - smoothstep(0.18, 0.5, d)); }",
          }),
        );
        globe.add(points);
        setPeriod(`${data.dateFrom} — ${data.dateTo}`);
      })
      .catch(() => undefined);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let paused = reduced.matches;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let targetY = 0;
    let targetX = 0.18;
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.position.z = camera.aspect < 1 ? 5.4 / camera.aspect : 5.4;
      camera.updateProjectionMatrix();
    };
    const onMotion = () => { paused = reduced.matches || host.matches(":hover") || dragging; };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      host.setPointerCapture?.(event.pointerId);
      onMotion();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      targetY += (event.clientX - lastX) * 0.008;
      targetX += (event.clientY - lastY) * 0.004;
      targetX = Math.max(-0.7, Math.min(0.7, targetX));
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => { dragging = false; onMotion(); };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    reduced.addEventListener("change", onMotion);
    host.addEventListener("pointerenter", onMotion);
    host.addEventListener("pointerleave", onMotion);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    resize();

    let frame = 0;
    const render = () => {
      if (!paused) targetY += 0.0016;
      globe.rotation.y += (targetY - globe.rotation.y) * 0.06;
      globe.rotation.x += (targetX - globe.rotation.x) * 0.06;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", onMotion);
      host.removeEventListener("pointerenter", onMotion);
      host.removeEventListener("pointerleave", onMotion);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((item) => item?.dispose());
      });
      material.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] globe-stage" aria-label="Globo terrestre interactivo">
      <div ref={hostRef} className="h-full w-full touch-none cursor-grab active:cursor-grabbing" aria-hidden="true" />
      {webgl === false && (
        <img
          src="/textures/blue-marble.jpg"
          alt="Globo terrestre de respaldo"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      )}
      {webgl === null && <span className="sr-only" role="status">Cargando globo…</span>}
      <p className="absolute left-5 top-5 text-xs text-blue-100/80">NASA · Blue Marble</p>
      {period && <p className="absolute bottom-3 right-3 rounded-full bg-[var(--color-brand-900)]/85 px-3 py-1 text-xs text-white">Focos agregados: {period}</p>}
    </div>
  );
}
