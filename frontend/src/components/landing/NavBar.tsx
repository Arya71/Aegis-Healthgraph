import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";

const LINKS = [
  { href: "#ecosystem", label: "Ecosystem" },
  { href: "#paradigm", label: "Why Aegis" },
  { href: "#how", label: "How it works" },
  { href: "#cognee", label: "Technology" },
  { href: "#faq", label: "FAQ" },
];

export default function NavBar() {
  const [shown, setShown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 560);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {shown && (
        <motion.header
          initial={{ y: -72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -72, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 top-0 z-40 border-b border-line/10 bg-bg/70 backdrop-blur-xl"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
            <button onClick={() => navigate("/")} className="flex items-center gap-2">
              <span className="text-xl">🧠</span>
              <span className="gradient-text text-base font-extrabold">Aegis</span>
            </button>
            <nav className="ml-5 hidden gap-1 md:flex">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-fg/55 transition hover:bg-surface/5 hover:text-fg"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <button className="btn-primary !py-2" onClick={() => navigate("/dashboard")}>
                Enter Patient Graph →
              </button>
            </div>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
