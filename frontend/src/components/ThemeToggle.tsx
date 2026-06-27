import { motion } from "framer-motion";
import { useTheme } from "../lib/ThemeContext";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-label="Toggle color theme"
      className={`btn-ghost h-9 w-9 !px-0 ${className}`}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -30, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-base"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </motion.span>
    </button>
  );
}
