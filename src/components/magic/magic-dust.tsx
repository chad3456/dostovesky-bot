"use client";

import { useEffect, useRef } from "react";

/**
 * A drifting field of golden motes (Three.js) — like dust in candlelight or a
 * page sprinkled with floo powder. Subtle, behind the UI, fully cleaned up on
 * unmount. Degrades to nothing if WebGL is unavailable.
 */
export function MagicDust() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      } catch {
        return; // no WebGL — skip silently
      }

      const sizeTo = () => {
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      sizeTo();
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100,
      );
      camera.position.z = 22;

      const COUNT = 240;
      const positions = new Float32Array(COUNT * 3);
      const speeds = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 46;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        speeds[i] = 0.004 + Math.random() * 0.012;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      const material = new THREE.PointsMaterial({
        color: 0xc9a23a,
        size: 0.16,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        sizeTo();
      };
      window.addEventListener("resize", onResize);

      const pos = geometry.getAttribute("position") as import("three").BufferAttribute;
      const animate = () => {
        if (disposed) return;
        for (let i = 0; i < COUNT; i++) {
          let y = pos.getY(i) + speeds[i];
          if (y > 15) y = -15; // wrap upward drift
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        points.rotation.y += 0.0006;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none fixed inset-0 z-[54] opacity-70"
      aria-hidden
    />
  );
}
