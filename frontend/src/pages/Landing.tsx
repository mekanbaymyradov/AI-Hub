import HeroGeometric from "@/components/ui/hero-geometric";
import Navbar from "@/components/Navbar";
import Features from "@/components/Features";
import About from "@/components/About";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/context/theme";

export default function Landing() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <Navbar />
      <main>
        <HeroGeometric
          title1="Build your workspace"
          title2="with AI-Hub"
          color1={isDark ? "#2563EB" : "#3B82F6"}
          color2={isDark ? "#09090B" : "#EFF6FF"}
          bgColor={isDark ? "#09090B" : "#FFFFFF"}
          speed={1}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
          >
            <Link
              to="/login"
              className="px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-full transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 inline-block"
            >
              Get Started
            </Link>
          </motion.div>
        </HeroGeometric>
        <Features />
        <About />
      </main>
      <Footer />
    </div>
  );
}




