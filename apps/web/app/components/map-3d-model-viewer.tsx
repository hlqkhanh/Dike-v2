"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

interface Map3DModelViewerProps {
  modelUrl?: string;
  className?: string;
}

export function Map3DModelViewer({
  modelUrl = "/images/HCMC-map-3dmodel2.glb",
  className = "",
}: Map3DModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isDisposed = false;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup (Isometric perspective vantage, brought closer for larger display)
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 100);
    camera.position.set(1.5, 1.25, 1.5);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.outline = "none";
    renderer.domElement.style.touchAction = "manipulation";
    renderer.domElement.style.cursor = "grab";

    container.appendChild(renderer.domElement);

    // 4. OrbitControls setup (Locked/Restricted to graceful Y-axis rotation and bounded zoom)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = true; // Bounded zoom enabled
    controls.minDistance = 1.35; // Limit zoom in (no clipping)
    controls.maxDistance = 3.6; // Limit zoom out (keep map in focus)
    controls.zoomSpeed = 0.8;
    controls.autoRotate = true; // Temporarily pause during alignment check
    controls.autoRotateSpeed = 0.35; // Gentle, slow cinematic rotation around Y axis
    controls.minPolarAngle = Math.PI / 4.2; // ~42° vantage
    controls.maxPolarAngle = Math.PI / 2.3; // ~78° vantage (stay above earth base)
    controls.target.set(0, 0.18, 0);

    const onStart = () => {
      renderer.domElement.style.cursor = "grabbing";
    };
    const onEnd = () => {
      renderer.domElement.style.cursor = "grab";
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    // 5. Lighting matching Dike website aesthetic
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xf4fbf7, 0x99deb6, 0.85);
    scene.add(hemisphereLight);

    // Sunlight from top
    const sunLight = new THREE.DirectionalLight(0xfff9f0, 2.2);
    sunLight.position.set(4, 7, 3);
    scene.add(sunLight);

    // Fill light with subtle fresh green tint
    const fillLight = new THREE.DirectionalLight(0xdcfce7, 1.1);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    // 6. Load GLB Model
    const loader = new GLTFLoader();
    const pivot = new THREE.Group();
    scene.add(pivot);

    loader.load(
      modelUrl,
      (gltf) => {
        if (isDisposed) return;

        // Calculate bounding box and center pivot exactly around vertical Y axis
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());

        // Center on X and Z, keep baseline grounded
        gltf.scene.position.x = -center.x;
        gltf.scene.position.z = -center.z;
        gltf.scene.position.y = -box.min.y;

        pivot.add(gltf.scene);
        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          const percent = Math.min(
            Math.round((xhr.loaded / xhr.total) * 100),
            99,
          );
          setLoadingProgress(percent);
        }
      },
      (error) => {
        if (isDisposed) return;
        console.error("Lỗi khi tải model 3D:", error);
        setLoadError("Không thể tải model 3D.");
        setIsLoading(false);
      },
    );

    // 7. Render Loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(container);

    // 9. Cleanup
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.dispose();

      // Dispose 3D scene objects
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  return (
    <div className={`map-3d-model-wrapper ${className}`}>
      {/* 3D Canvas Container */}
      <div
        ref={containerRef}
        className="map-3d-canvas-container"
        aria-label="Mô hình 3D tương tác bản đồ thành phố"
      />

      {/* Loading Progress Overlay */}
      {isLoading && !loadError && (
        <div className="map-3d-loading-overlay">
          <div className="map-3d-spinner" aria-hidden="true" />
          <div className="map-3d-loading-info">
            <span className="loading-label">Đang tải mô hình 3D…</span>
            <span className="loading-percent">{loadingProgress}%</span>
          </div>
          <div className="map-3d-progress-track">
            <div
              className="map-3d-progress-bar"
              style={{ width: `${Math.max(loadingProgress, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {loadError && (
        <div className="map-3d-error-fallback">
          <p>{loadError}</p>
        </div>
      )}
    </div>
  );
}
