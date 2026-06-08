import React, { useRef, useLayoutEffect, useMemo } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScanSearch, Bot, AlertTriangle, CheckCircle } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FloatingPapers = () => {
  const groupRef = useRef();
  const papers = useMemo(
    () =>
      Array.from({ length: 12 }).map(() => ({
        x: (Math.random() - 0.5) * 15,
        y: (Math.random() - 0.5) * 15,
        z: (Math.random() - 0.5) * 8 - 2,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotZ: Math.random() * Math.PI,
        speed: Math.random() * 0.015 + 0.005,
      })),
    []
  );

  useFrame((state, delta) => {
    papers.forEach((p, i) => {
      const mesh = groupRef.current.children[i];
      mesh.rotation.x += p.speed * 0.3;
      mesh.rotation.y += p.speed * 0.4;
      mesh.userData.time = (mesh.userData.time || 0) + delta;
      mesh.position.y += Math.sin(mesh.userData.time * p.speed * 20) * 0.01;
    });
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      (state.pointer.y * Math.PI) / 10,
      0.05
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      (state.pointer.x * Math.PI) / 10,
      0.05
    );
  });

  return (
    <group ref={groupRef}>
      {papers.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} rotation={[p.rotX, p.rotY, p.rotZ]}>
          <planeGeometry args={[1.2, 1.6]} />
          <meshBasicMaterial
            color="#4f46e5"
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            wireframe
          />
        </mesh>
      ))}
    </group>
  );
};

const DocumentScanner = () => {
  const wrapperRef = useRef(null);
  const sectionRef = useRef(null);
  const tiltRef = useRef(null);
  const laserRef = useRef(null);
  const imageLayerRef = useRef(null);
  const glareRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        tiltRef.current,
        { rotationX: 15, y: 100, opacity: 0, scale: 0.95 },
        {
          rotationX: 0,
          y: 0,
          opacity: 1,
          scale: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 80%",
            end: "top 30%",
            scrub: 1,
          },
        }
      );

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperRef.current,
          pin: true,
          scrub: 1,
          start: "top top",
          end: "+=250%",
          anticipatePin: 1,
        },
      });

      tl.to(laserRef.current, { top: "100%", ease: "none", duration: 1 }, 0);
      tl.to(
        imageLayerRef.current,
        { clipPath: "inset(100% 0% 0% 0%)", ease: "none", duration: 1 },
        0
      );
      tl.from(
        ".ai-ui-item",
        { y: 30, opacity: 0, stagger: 0.15, duration: 0.4, ease: "power3.out" },
        0.2
      );
    }, wrapperRef);
    return () => ctx.revert();
  }, []);

  const handleMouseMove = (e) => {
    if (!tiltRef.current || !glareRef.current) return;
    const rect = tiltRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    const centerX = rect.width / 2,
      centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10,
      rotateY = ((x - centerX) / centerX) * 10;

    gsap.to(tiltRef.current, { rotateX, rotateY, ease: "power2.out", duration: 0.5 });
    gsap.to(glareRef.current, {
      background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)`,
      opacity: 1,
      ease: "power2.out",
      duration: 0.5,
    });
  };

  const handleMouseLeave = () => {
    if (!tiltRef.current || !glareRef.current) return;
    gsap.to(tiltRef.current, { rotateX: 0, rotateY: 0, ease: "power3.out", duration: 1 });
    gsap.to(glareRef.current, { opacity: 0, ease: "power3.out", duration: 1 });
  };

  return (
    <div ref={wrapperRef} className="relative w-full z-10 bg-[#050505]">
      <section
        ref={sectionRef}
        className="relative h-screen flex items-center justify-center overflow-hidden bg-transparent"
      >
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
          <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <FloatingPapers />
          </Canvas>
        </div>

        <div className="max-w-6xl mx-auto px-6 w-full text-center relative z-10 flex flex-col h-full justify-center">
          <div className="mb-10">
            <h2 className="text-indigo-500 font-bold tracking-[0.2em] uppercase text-sm mb-4 inline-flex items-center gap-2">
              <ScanSearch size={16} /> Interactive 3D Forensic Scan
            </h2>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-white">
              Transform chaos into clarity.
            </h3>
          </div>

          <div style={{ perspective: "1500px" }} className="w-full h-[60vh] md:h-[65vh]">
            <div
              ref={tiltRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full h-full cursor-crosshair"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className="absolute inset-0 bg-[#0a0a0c] p-8 md:p-14 flex flex-col md:flex-row items-center gap-10 text-left rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(79,70,229,0.15)]"
                style={{ transform: "translateZ(-30px)" }}
              >
                <div className="flex-1">
                  <div className="ai-ui-item flex items-center gap-3 text-indigo-400 mb-6">
                    <Bot size={28} />
                    <span className="font-bold tracking-widest uppercase text-sm">
                      AI Analysis Complete
                    </span>
                  </div>
                  <h4 className="ai-ui-item text-3xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">
                    "You are absorbing <span className="text-rose-500">unbounded</span> liability."
                  </h4>
                  <p className="ai-ui-item text-slate-400 text-lg leading-relaxed max-w-lg">
                    The document explicitly forces you to cover all future costs, even those out of your control.
                    We strongly recommend renegotiating the indemnity clause.
                  </p>
                </div>
                <div className="flex-1 w-full space-y-4">
                  <div className="ai-ui-item p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-4 backdrop-blur-sm shadow-xl">
                    <AlertTriangle className="text-rose-500 shrink-0 mt-1" />
                    <div>
                      <div className="text-white font-bold text-lg mb-1">High Risk Detected</div>
                      <div className="text-rose-400/80">
                        Indemnity clause exposes you to severe financial risk.
                      </div>
                    </div>
                  </div>
                  <div className="ai-ui-item p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-4 backdrop-blur-sm shadow-xl">
                    <CheckCircle className="text-emerald-500 shrink-0 mt-1" />
                    <div>
                      <div className="text-white font-bold text-lg mb-1">Standard Confidentiality</div>
                      <div className="text-emerald-400/80">
                        NDA terms are standard industry practice and safe to sign.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                ref={imageLayerRef}
                className="absolute inset-0 bg-slate-100 flex items-center justify-center p-10 rounded-3xl overflow-hidden shadow-2xl"
                style={{ transform: "translateZ(30px)", clipPath: "inset(0% 0% 0% 0%)" }}
              >
                <img
                  src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=2000"
                  alt="Complex Legal Document"
                  className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-multiply pointer-events-none"
                />
                <div className="relative z-10 text-slate-800 font-mono text-sm md:text-xl leading-relaxed text-justify opacity-60 filter blur-[0.5px]">
                  "IN WITNESS WHEREOF, the parties hereto have caused this Agreement to be executed by their duly
                  authorized representatives. The Receiving Party shall hold and maintain the Confidential
                  Information in strictest confidence for the sole and exclusive benefit of the Disclosing Party.
                  Furthermore, the Indemnifying Party agrees to defend, indemnify, and hold harmless the
                  Indemnified Party from any and all unforeseen, unbounded liabilities, costs, damages, and
                  expenses whatsoever arising out of..."
                  <br />
                  <br />
                  <span className="font-bold border-b border-slate-400">SIGNATURE: _______________________</span>
                </div>
              </div>

              <div
                ref={laserRef}
                className="absolute left-0 right-0 h-[3px] bg-indigo-500 rounded-full"
                style={{
                  top: "0%",
                  transform: "translateZ(60px)",
                  boxShadow:
                    "0px 0px 20px 5px rgba(79, 70, 229, 0.6), 0px 0px 40px 10px rgba(79, 70, 229, 0.3)",
                }}
              >
                <div className="absolute top-1/2 left-0 w-8 h-8 bg-white rounded-full -translate-y-1/2 -translate-x-1/2 blur-[6px]" />
                <div className="absolute top-1/2 right-0 w-8 h-8 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-[6px]" />
              </div>

              <div
                ref={glareRef}
                className="absolute inset-0 rounded-3xl pointer-events-none mix-blend-screen opacity-0"
                style={{ transform: "translateZ(65px)" }}
              />
            </div>
          </div>
          <p className="mt-8 text-slate-500 text-sm tracking-widest uppercase animate-pulse">
            Hover to explore in 3D • Scroll down to scan
          </p>
        </div>
      </section>
    </div>
  );
};

export default DocumentScanner;