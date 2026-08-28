"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * Single 3D Refractive Glass Torus Ring (Original First Design)
 */
function SingleGlassRing() {
  const ringRef = useRef<THREE.Mesh>(null);

  // Smooth rotation animation
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.x = elapsed * 0.15;
      ringRef.current.rotation.y = elapsed * 0.20;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={0.8}>
      <mesh ref={ringRef} rotation={[0.5, -0.3, 0]}>
        <torusGeometry args={[2.2, 0.42, 64, 128]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          thickness={0.9}
          chromaticAberration={0.15}
          anisotropy={0.4}
          distortion={0.12}
          distortionScale={0.3}
          temporalDistortion={0.02}
          clearcoat={1}
          clearcoatRoughness={0.05}
          color="#2563EB"
          transmission={0.7}
          roughness={0.05}
          ior={1.3}
          resolution={512}
        />
      </mesh>
    </Float>
  );
}

/**
 * Soft Floating Starfield Particle Field
 */
function FloatingParticles({ count = 35 }) {
  const pointsRef = useRef<THREE.Group>(null);
  const [particles] = useState(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 6
        ),
        speed: 0.1 + Math.random() * 0.2,
        scale: 0.04 + Math.random() * 0.06,
        wiggleSpeed: 0.5 + Math.random() * 1.5,
        seed: Math.random() * 100
      });
    }
    return temp;
  });

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.children.forEach((mesh, index) => {
        const p = particles[index];
        mesh.position.y += p.speed * 0.02;
        mesh.position.x += Math.sin(elapsed * p.wiggleSpeed + p.seed) * 0.005;
        if (mesh.position.y > 6) {
          mesh.position.y = -6;
        }
      });
    }
  });

  return (
    <group ref={pointsRef}>
      {particles.map((p, idx) => (
        <mesh key={idx} position={p.position}>
          <sphereGeometry args={[p.scale, 16, 16]} />
          <meshBasicMaterial
            color="#3B82F6"
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function GlassBackground() {
  const [mounted, setMounted] = useState(false);
  const [responsiveCamY, setResponsiveCamY] = useState(8);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setResponsiveCamY(11);
      } else if (window.innerWidth < 1024) {
        setResponsiveCamY(9.5);
      } else {
        setResponsiveCamY(8.0);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none bg-[#000000] overflow-hidden">
      {/* Top subtle blue glow radial */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none" 
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(37,99,235,0.15) 0%, transparent 100%)"
        }} 
      />

      {/* 3D Single Ring Canvas */}
      <div className="absolute inset-0 opacity-80">
        <Canvas camera={{ position: [0, 0, responsiveCamY], fov: 45 }}>
          <ambientLight intensity={1.5} />
          <directionalLight position={[10, 10, 5]} intensity={2.2} color="#ffffff" />
          <directionalLight position={[-10, 10, -5]} intensity={1.5} color="#3B82F6" />
          <directionalLight position={[5, -10, 5]} intensity={1.2} color="#F59E0B" />
          <directionalLight position={[-5, -10, -5]} intensity={1.0} color="#10B981" />

          <Suspense fallback={null}>
            <SingleGlassRing />
            <FloatingParticles count={35} />
            <Environment preset="city" />
            <ContactShadows
              position={[0, -2.8, 0]}
              opacity={0.25}
              scale={18}
              blur={3.5}
              color="#1e293b"
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Subtle Dot Grid */}
      <div 
        className="absolute inset-0 opacity-[0.20]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}
