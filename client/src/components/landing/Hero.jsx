import React, { useRef, useLayoutEffect, useState } from 'react';
import { Gavel, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';

const MagneticButton = ({ children, className, onClick }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) * 0.2;
    const y = (clientY - (top + height / 2)) * 0.2;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ transform: `translate(${position.x}px, ${position.y}px)`, transition: 'transform 0.1s ease-out' }}
      className={className}
    >
      {children}
    </button>
  );
};

const Hero = () => {
  const navigate = useNavigate();
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const btnsRef = useRef(null);
  const heroRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const words = titleRef.current.querySelectorAll('.word');
      
      gsap.from(words, {
        y: 100, opacity: 0, rotate: 10, duration: 1, stagger: 0.1, ease: "power4.out", delay: 0.2
      });

      gsap.from(subtitleRef.current, {
        y: 30, opacity: 0, duration: 1, ease: "power3.out", delay: 0.8
      });

      gsap.from(btnsRef.current, {
        y: 30, opacity: 0, duration: 1, ease: "power3.out", delay: 1.2
      });

      gsap.to(heroRef.current, {
        yPercent: 30, opacity: 0,
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      });
    });

    return () => ctx.revert();
  }, []);

  const headline = "Don't just read contracts. Forensically analyze them.";
  
  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 pt-20 bg-[#050505]">
      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-sm">
          <Zap size={14} className="animate-pulse" />
          <span>Next-Gen Legal Intelligence</span>
        </div>

        <div className="max-w-4xl mx-auto overflow-hidden">
          <h1 ref={titleRef} className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-6 leading-tight flex flex-wrap justify-center gap-[0.2em] pb-2">
            {headline.split(" ").map((word, idx) => (
              <span key={idx} className={`word inline-block ${word.includes('them') || word.includes('analyze') ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600' : ''}`}>
                {word}
              </span>
            ))}
          </h1>
        </div>

        <p ref={subtitleRef} className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
          Nyay Sahayak uses advanced AI to strip away legal complexity, 
          identifying hidden risks and predatory clauses in seconds.
        </p>

        <div ref={btnsRef} className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <MagneticButton onClick={() => navigate('/chat')} className="group px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-500 transition-colors shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] flex items-center gap-2">
            Get Started Free
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </MagneticButton>
          <MagneticButton className="px-8 py-4 bg-transparent text-slate-300 border border-white/20 rounded-xl font-bold text-lg hover:bg-white/5 transition-colors backdrop-blur-sm">
            Explore Features
          </MagneticButton>
        </div>

        <div className="mt-20 pt-8 border-t border-white/10 flex flex-wrap justify-center gap-12 opacity-50">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck size={18} />
            <span>AES-256 Protected</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Gavel size={18} />
            <span>Nyay Sahayak v1.0</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;