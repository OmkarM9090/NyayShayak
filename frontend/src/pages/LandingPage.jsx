import React, { useLayoutEffect, useRef } from 'react';
import Lenis from 'lenis';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import DocumentScanner from '../components/landing/DocumentScanner';
import HowItWorks from '../components/landing/HowItWorks';

gsap.registerPlugin(ScrollTrigger);

// ----------------------------------------------------------------------
// 3D WebGL Background 
// ----------------------------------------------------------------------
const AbstractNetwork = () => {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.05;
      meshRef.current.rotation.y += delta * 0.1;
      
      // We calculate time accumulated through delta to avoid using state.clock which uses deprecated THREE.Clock
      meshRef.current.userData.time = (meshRef.current.userData.time || 0) + delta;
      meshRef.current.position.y = Math.sin(meshRef.current.userData.time) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} scale={2}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial 
        color="#4f46e5" 
        wireframe={true} 
        transparent={true} 
        opacity={0.15} 
      />
    </mesh>
  );
};

const Background3D = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-80 mix-blend-screen bg-[#050505]">
      <Canvas camera={{ position: [0, 0, 4], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#4f46e5" />
        <AbstractNetwork />
      </Canvas>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full" />
    </div>
  );
};

// ----------------------------------------------------------------------
// Custom Cursor Component
// ----------------------------------------------------------------------
const CustomCursor = () => {
  const cursorRef = useRef(null);

  useLayoutEffect(() => {
    const moveCursor = (e) => {
      gsap.to(cursorRef.current, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.2,
        ease: "power2.out"
      });
    };
    window.addEventListener('mousemove', moveCursor);
    return () => window.removeEventListener('mousemove', moveCursor);
  }, []);

  return (
    <div 
      ref={cursorRef} 
      className="fixed top-0 left-0 w-6 h-6 bg-indigo-500 rounded-full mix-blend-screen pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 blur-[2px]"
    />
  );
};

export default function LandingPage() {
  
  useLayoutEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0, 0);

    // Forces GSAP to recalculate all layouts after rendering to prevent overlapping
    const timeout = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    return () => {
      clearTimeout(timeout);
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  return (
    <div className="relative bg-[#050505] min-h-screen text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200 cursor-none">
      <CustomCursor />
      <Background3D />
      
      {/* Changed overflow-hidden to overflow-x-clip for better GSAP performance */}
      <main className="relative z-10 w-full overflow-x-clip">
        <Hero />
        <Features />
        <DocumentScanner />
        <HowItWorks />
      </main>
      
      <footer className="relative z-10 py-10 border-t border-white/5 text-center text-slate-500 text-sm bg-[#050505]">
        <p>© 2026 Nyay Sahayak. All rights reserved.</p>
      </footer>
    </div>
  );
}