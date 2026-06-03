"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * 3D Planetary Torus System (Gold Chrome + Refractive Glass)
 */
function PlanetaryRings() {
  const glassRef = useRef<THREE.Mesh>(null);
  const metalRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Smooth rotation loops
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    
    if (glassRef.current) {
      glassRef.current.rotation.x = elapsed * 0.15;
      glassRef.current.rotation.y = elapsed * 0.18;
    }
    if (metalRef.current) {
      metalRef.current.rotation.x = -elapsed * 0.25;
      metalRef.current.rotation.y = -elapsed * 0.12;
      metalRef.current.rotation.z = elapsed * 0.15;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(elapsed * 0.05) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. Primary Ring: Rainbow Refraction Glass Torus */}
      <Float speed={2} rotationIntensity={0.6} floatIntensity={0.8}>
        <mesh ref={glassRef} rotation={[0.4, -0.4, 0]}>
          <torusGeometry args={[2.0, 0.38, 48, 96]} />
          <MeshTransmissionMaterial
            backside
            samples={5}
            thickness={0.8}
            chromaticAberration={0.12} // Rainbow aberration refraction
            anisotropy={0.4}
            distortion={0.15}
            distortionScale={0.3}
            temporalDistortion={0.02}
            clearcoat={1}
            clearcoatRoughness={0.08}
            color="#2563EB" // Deep electric blue
            transmission={0.6}
            roughness={0.06}
            ior={1.25} // Index of Refraction
            resolution={512}
          />
        </mesh>
      </Float>

      {/* 2. Secondary Ring: Polished Gold Chrome Torus (Gyroscopic Intersecting) */}
      <Float speed={1.5} rotationIntensity={1.2} floatIntensity={1.4}>
        <mesh ref={metalRef} rotation={[-0.6, 0.6, 0.5]}>
          <torusGeometry args={[1.35, 0.08, 32, 64]} />
          <meshStandardMaterial
            color="#F59E0B" // Rich Amber Gold
            roughness={0.04}
            metalness={1.0}
            envMapIntensity={2.5}
          />
        </mesh>
      </Float>
      
      {/* 3. Orbiting Glass Spheres */}
      <Float speed={3} rotationIntensity={2} floatIntensity={2}>
        <group rotation={[0.2, 0.4, 0.1]}>
          {[
            { pos: [3, 1, 0.5], size: 0.18, color: "#10B981" }, // Emerald
            { pos: [-2.5, -1.8, -1], size: 0.12, color: "#EF4444" }, // Ruby
            { pos: [1.2, -2.8, 1.5], size: 0.15, color: "#F59E0B" }  // Topaz
          ].map((sp, idx) => (
            <mesh key={idx} position={sp.pos as [number, number, number]}>
              <sphereGeometry args={[sp.size, 32, 32]} />
              <MeshTransmissionMaterial
                thickness={0.4}
                chromaticAberration={0.05}
                color={sp.color}
                transmission={0.8}
                roughness={0.05}
                resolution={256}
              />
            </mesh>
          ))}
        </group>
      </Float>
    </group>
  );
}

/**
 * Soft Floating Particle Field (Background Ambient Starfield)
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
        // Move slowly upwards
        mesh.position.y += p.speed * 0.02;
        // Wiggle slowly on X
        mesh.position.x += Math.sin(elapsed * p.wiggleSpeed + p.seed) * 0.005;
        
        // Loop back to bottom when leaving top screen
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
            color="#2563EB"
            transparent
            opacity={0.12}
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
    // Responsive camera zoom helper
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setResponsiveCamY(11); // mobile - zoom out to fit rings
      } else if (window.innerWidth < 1024) {
        setResponsiveCamY(9.5); // tablet
      } else {
        setResponsiveCamY(8.0); // desktop
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-60">
      <Canvas camera={{ position: [0, 0, responsiveCamY], fov: 45 }}>
        {/* Soft studio ambient light */}
        <ambientLight intensity={1.5} />
        
        {/* Directional Lights representing department colors */}
        <directionalLight position={[10, 10, 5]} intensity={2.2} color="#ffffff" />
        <directionalLight position={[-10, 10, -5]} intensity={1.5} color="#3B82F6" /> {/* Google Blue */}
        <directionalLight position={[5, -10, 5]} intensity={1.2} color="#F59E0B" />  {/* Amber Gold */}
        <directionalLight position={[-5, -10, -5]} intensity={1.0} color="#10B981" /> {/* Emerald */}

        <Suspense fallback={null}>
          {/* Nested Rings and stars */}
          <PlanetaryRings />
          <FloatingParticles count={40} />
          
          {/* HDRI reflections */}
          <Environment preset="city" />
          
          {/* Dynamic ring contact shadow */}
          <ContactShadows
            position={[0, -2.8, 0]}
            opacity={0.22}
            scale={18}
            blur={3.5}
            color="#1e293b"
          />
        </Suspense>
      </Canvas>

      {/* Subtle Dot Grid */}
      <div 
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: "radial-gradient(rgba(37,99,235,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}
