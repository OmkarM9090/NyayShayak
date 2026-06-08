import React, { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Upload, Cpu, ShieldCheck, ArrowRight } from 'lucide-react';

const HowItWorks = () => {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const floaters = gsap.utils.toArray('.floater');
      floaters.forEach(floater => {
        const speed = floater.dataset.speed;
        gsap.to(floater, {
          y: () => -100 * speed,
          ease: "none",
          scrollTrigger: {
            trigger: floater.parentElement,
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        });
      });

      const rows = gsap.utils.toArray('.step-row');
      rows.forEach(row => {
        gsap.from(row, {
          y: 100,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: row,
            start: "top 80%",
            toggleActions: "play none none reverse"
          }
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const steps = [
    { title: "Upload Document", description: "Securely upload your PDF or image files. Our system immediately masks sensitive data to protect your privacy.", icon: <Upload size={32} /> },
    { title: "Forensic Analysis", description: "Gemini AI scans every clause, identifying hidden risks and translating complex legal jargon into plain English.", icon: <Cpu size={32} /> },
    { title: "Get Instant Clarity", description: "Review a high-level risk report or chat directly with the document to ask specific legal questions.", icon: <ShieldCheck size={32} /> },
  ];

  return (
    <section ref={containerRef} className="py-32 bg-[#050505] relative z-10 w-full">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-24 step-row">
          <h2 className="text-indigo-500 font-bold tracking-[0.2em] uppercase text-sm mb-4">
            The Process
          </h2>
          <h3 className="text-4xl md:text-6xl font-serif font-bold text-white">
            Three Steps to Safety
          </h3>
        </div>

        <div className="space-y-32">
          {steps.map((step, index) => {
            const isEven = index % 2 === 0;
            return (
              <div key={index} className={`step-row flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12 md:gap-24`}>
                <div className="w-full md:w-1/2 relative">
                  <div className="aspect-square rounded-full bg-gradient-to-tr from-indigo-900/20 to-transparent border border-white/5 flex items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="w-32 h-32 bg-[#0a0a0c] border border-indigo-500/30 rounded-3xl flex items-center justify-center text-indigo-400 shadow-[0_0_50px_rgba(79,70,229,0.2)] z-10 transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                      {step.icon}
                    </div>
                    
                    <div data-speed="1.5" className="floater absolute top-20 right-20 w-8 h-8 rounded-full bg-indigo-500/20" />
                    <div data-speed="0.8" className="floater absolute bottom-20 left-20 w-12 h-12 rounded-full border border-indigo-500/20" />
                  </div>
                </div>

                <div className="w-full md:w-1/2 text-center md:text-left">
                  <div className="text-indigo-500 font-serif text-2xl font-bold mb-4">Step 0{index + 1}</div>
                  <h4 className="text-3xl md:text-4xl font-bold text-white mb-6">{step.title}</h4>
                  <p className="text-slate-400 leading-relaxed text-lg max-w-md mx-auto md:mx-0">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-40 text-center step-row">
          <button className="inline-flex items-center gap-4 px-10 py-5 bg-white text-[#050505] rounded-full font-bold text-xl hover:bg-indigo-50 transition-colors shadow-[0_0_40px_rgba(255,255,255,0.2)] group">
            Start Your First Analysis
            <span className="w-8 h-8 rounded-full bg-[#050505] text-white flex items-center justify-center group-hover:translate-x-2 transition-transform">
              <ArrowRight size={16} />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;