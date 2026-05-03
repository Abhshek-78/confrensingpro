import { useEffect, useRef, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Landing.css";
import logoImg from "../utils/confreneview.png";
import sideimg from "../utils/newcorr.png";
import { Authcontext } from "../contexts/Authcontex.jsx";

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { userData, handleLogout } = useContext(Authcontext);
  const navigate = useNavigate();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 36);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const generateRandomRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 11);
    navigate(`/${randomId}`);
  };

  const handleLogoutClick = () => {
    handleLogout();
    navigate("/");
  };

  return (
    <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
      <div className="wrap">
        <Link to="/" className="nav-logo">
            <img src={logoImg} alt="Conferencing Pro Logo" className="logo-img" />
          Conferencing<span className="gld">Pro</span>
        </Link>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#languages">Languages</a></li>
          <li><a href="#trust">Security</a></li>
          <li><a href="#cta">Enterprise</a></li>
          
          {userData ? (
            <>
              <li><button onClick={generateRandomRoom} className="nav-button">Create Meeting</button></li>
              <li><button onClick={generateRandomRoom} className="nav-button">Join Meeting</button></li>
              <li><button onClick={handleLogoutClick} className="nav-logout-btn">Logout</button></li>
            </>
          ) : (
            <li><Link to="/auth" className="btn-gold1-link">Register</Link></li>
          )}
        </ul>
      </div>
    </nav>
  );
}

function useReveal(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => el.classList.add("in"), delay);
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return ref;
}

function SphereScene() {
  return (
    <div className="sphere-scene">
      <img src={sideimg} alt="Mainlogo" className="sideimg-animated" />
    </div>
  );
}

function CubeScene() {
  return (
    <div className="cube-scene">
      <div className="cube-ring cube-ring-1" />
      <div className="cube-ring cube-ring-2" />
      <div className="cube-3d">
        {["front","back","left","right","top","bottom"].map(f => (
          <div key={f} className={`cube-face ${f}`} />
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <div className="wrap">
        <div className="hero-left">
          
          <h1 className="hero-title">
            Conferencing
            <span className="italic-gold">Pro</span>
          </h1>

          <p className="hero-sub">
            Build trust across borders with real-time multilingual conferencing
            that makes every conversation count — confidential, clear, and global.
          </p>

          <div className="hero-actions">
            <a href="#cta" className="btn-gold">Start Free Trial</a>
            <a href="#trust" className="btn-outline">Watch Demo</a>
          </div>
        </div>

        <div className="hero-right">
          <SphereScene />
        </div>
      </div>
    </section>
  );
}


const STATS = [
  { num: "95+",     label: "Languages Supported" },
  { num: "0.3s",    label: "Translation Latency"  },
  { num: "256-bit", label: "AES Encryption"        },
  { num: "50K+",    label: "Global Enterprises"    },
];

function StatsBar() {
  return (
    <div className="stats-bar">
      <div className="wrap">
        {STATS.map(s => (
          <div className="stat-item" key={s.label}>
            <span className="stat-num">{s.num}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


const FEATURES = [
  { icon:"🌐", title:"50+ Languages",       desc:"Real-time AI translation across 50+ languages with accuracy that preserves tone, nuance, and full intent." },
  { icon:"📹", title:"HD Video & Audio",    desc:"Crystal-clear communication with adaptive quality for any connection — from boardrooms to remote desktops." },
  { icon:"🛡️", title:"Enterprise Security",desc:"End-to-end encryption and compliance with global data standards. Your conversations stay strictly yours." },
  { icon:"💬", title:"Live Subtitles",      desc:"Automatic captions in multiple languages simultaneously for better accessibility and comprehension." },
  { icon:"🎙️", title:"Voice Intelligence", desc:"AI noise cancellation, speaker ID, and auto-generated multilingual meeting minutes delivered instantly." },
  { icon:"📊", title:"Meeting Analytics",   desc:"Sentiment tracking, engagement metrics, and multilingual action-item summaries delivered post-call." },
];

function FeatCard({ icon, title, desc, delay }) {
  const ref = useReveal(delay);
  return (
    <div className="feat-card reveal" ref={ref}>
      <div className="feat-icon">{icon}</div>
      <h3 className="feat-title">{title}</h3>
      <p className="feat-desc">{desc}</p>
    </div>
  );
}

function FeaturesSection() {
  const hdr = useReveal(0);
  return (
    <section className="features-sec" id="features">
      <div className="wrap">
        <div className="sec-hdr-center reveal" ref={hdr}>
          <span className="eyebrow">Why ConferencingPro</span>
          <h2 className="sec-title">
            Speak Any Language,{" "}
            <span className="gld it">Build Every Deal</span>
          </h2>
          <p className="sec-desc">
            Real-time translation and cultural adaptation for seamless global
            communication — built for the modern boardroom.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <FeatCard key={f.title} {...f} delay={i * 75} />
          ))}
        </div>
      </div>
    </section>
  );
}

const TRUST_POINTS = [
  "AI-powered cultural context awareness",
  "Tone and sentiment preservation",
  "Professional interpreters on-demand",
  "24/7 global support in 40+ languages",
  "SOC 2 Type II & GDPR compliant",
];

function TrustSection() {
  const ref = useReveal(0);
  return (
    <section className="trust-sec" id="trust">
      <div className="wrap">
        <CubeScene />

        <div className="reveal" ref={ref}>
          <span className="eyebrow">Trust & Communication</span>
          <h2 className="trust-title">
            Build Trust Through{" "}
            <span className="gld it">Clear Communication</span>
          </h2>
          <p className="trust-desc">
            When language isn't a barrier, trust flows naturally. Our platform
            ensures every nuance, tone, and intention is preserved across cultures.
          </p>
          <ul className="trust-list">
            {TRUST_POINTS.map(p => (
              <li className="trust-item" key={p}>
                <span className="trust-dot" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const LANGS = [
  "🇺🇸 English","🇨🇳 Mandarin","🇪🇸 Spanish","🇸🇦 Arabic",
  "🇫🇷 French","🇩🇪 German","🇯🇵 Japanese","🇮🇳 Hindi",
  "🇷🇺 Russian","🇧🇷 Portuguese","🇰🇷 Korean","🇮🇹 Italian",
  "🇳🇱 Dutch","🇸🇪 Swedish","+ 81 More",
];

function LanguagesSection() {
  const ref = useReveal(0);
  return (
    <section className="lang-sec" id="languages">
      <div className="wrap">
        <div className="reveal" ref={ref}>
          <span className="eyebrow">Global Reach</span>
          <h2 className="sec-title">
            One Platform,{" "}
            <span className="gld it">Every Tongue</span>
          </h2>
        </div>
        <div className="lang-grid">
          {LANGS.map(l => (
            <span className="lang-pill" key={l}>{l}</span>
          ))}
        </div>
      </div>
    </section>
  );
}


function CtaSection() {
  const ref = useReveal(0);
  return (
    <section className="cta-sec" id="cta">
      <div className="wrap">
        <div className="reveal" ref={ref}>
          <h2 className="cta-title">
            Ready to Break Down
            <span className="block gld it">Language Barriers?</span>
          </h2>
          <p className="cta-sub">
            Join thousands of businesses building stronger relationships
            across the globe.
          </p>
          <div className="cta-actions">
            <a href="#" className="btn-gold">Get Started Free</a>
            <a href="#" className="btn-outline">Contact Sales</a>
          </div>
        </div>
      </div>
    </section>
  );
}


function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div>
          <div className="footer-logo">
            Conferencing<span className="gld">Pro</span>
          </div>
          <p className="footer-tag">Breaking barriers, building trust</p>
        </div>
        <nav className="footer-nav">
          {["Privacy","Security","Terms","Blog","Contact"].map(l => (
            <a key={l} href="#">{l}</a>
          ))}
        </nav>
        <p className="footer-copy">© 2026 ConferencingPro. All rights reserved.</p>
      </div>
    </footer>
  );
}
export default function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <FeaturesSection />
        <TrustSection />
        <LanguagesSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}