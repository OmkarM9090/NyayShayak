import React, { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ShieldAlert, FileSearch, Zap, Lock, Scale, MessageSquare } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Features = () => {
  const wrapperRef = useRef(null);
  const trackRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      
      // Calculate dynamic scroll distance
      const getScrollAmount = () => -(trackRef.current.scrollWidth - window.innerWidth + 120);

      // Horizontal translation tween
      const scrollTween = gsap.to(trackRef.current, {
        x: getScrollAmount,
        ease: "none"
      });

      // Pin the container
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        pin: true,
        start: "top top",
        end: () => `+=${trackRef.current.scrollWidth}`,
        animation: scrollTween,
        scrub: 1,
        invalidateOnRefresh: true,
        anticipatePin: 1
      });

      // INNER CARD ANIMATION: Pops up as you scroll horizontally!
      gsap.utils.toArray('.feature-card').forEach((card) => {
        gsap.from(card, {
          y: 80,
          opacity: 0,
          scale: 0.9,
          duration: 0.8,
          ease: "back.out(1.2)",
          scrollTrigger: {
            trigger: card,
            containerAnimation: scrollTween, // Magic line that tracks horizontal movement
            start: "left 85%", 
            toggleActions: "play none none reverse"
          }
        });
      });

    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  const features = [
    { title: "Risk Detection", description: "Instantly identify hidden liabilities and dangerous clauses before you sign.", icon: <ShieldAlert size={32} /> },
    { title: "Legalese Decoder", description: "Translate complex legal jargon into simple, actionable English.", icon: <Scale size={32} /> },
    { title: "Smart Summarization", description: "Get a high-level executive summary of 50+ page documents in just 10 seconds.", icon: <FileSearch size={32} /> },
    { title: "Interactive Analysis", description: "Chat directly with your documents to ask specific questions about obligations or dates.", icon: <MessageSquare size={32} /> },
    { title: "Forensic Precision", description: "Powered by Gemini AI, specifically tuned for structural legal document analysis.", icon: <Zap size={32} /> },
    { title: "Enterprise Security", description: "Your documents are AES-256 protected and masked before analysis to ensure total privacy.", icon: <Lock size={32} /> },
  ];

  return (
    // Solid background prevents previous sections from bleeding through
    <div ref={wrapperRef} className="relative w-full z-10 bg-[#050505]">
      <section className="relative h-screen flex flex-col justify-center overflow-hidden">
        
        <div className="px-6 md:px-20 mb-12 shrink-0">
          <h2 className="text-indigo-500 font-bold tracking-[0.2em] uppercase text-sm mb-4">
            Powerful Capabilities
          </h2>
          <h3 className="text-4xl md:text-6xl font-serif font-bold text-white max-w-2xl">
            Designed for Legal Clarity.
          </h3>
        </div>

        <div ref={trackRef} className="flex gap-8 px-6 md:px-20 pb-20 w-max will-change-transform">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="feature-card w-[85vw] md:w-100 h-112.5 p-10 rounded-3xl bg-[#0a0a0c]/80 backdrop-blur-md border border-white/5 relative overflow-hidden group hover:border-indigo-500/30 transition-colors flex flex-col justify-between shadow-2xl"
            >
              <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                  {feature.icon}
                </div>
                <h4 className="text-3xl font-bold text-white mb-4 leading-tight">
                  {feature.title}
                </h4>
                <p className="text-slate-400 leading-relaxed text-lg">
                  {feature.description}
                </p>
              </div>

              <div className="absolute bottom-8 right-8 text-6xl font-serif font-bold text-white/3 group-hover:text-white/8 transition-colors pointer-events-none">
                0{index + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 text-slate-500 text-sm tracking-widest uppercase opacity-60">
          <div className="w-12 h-px bg-slate-700" />
          Scroll sideways to explore
          <div className="w-12 h-px bg-slate-700" />
        </div>
      </section>
    </div>
  );
};

export default Features;