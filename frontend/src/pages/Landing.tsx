import HeroGeometric from "../../components/ui/hero-geometric";
import Navbar from "../../components/Navbar";
import Features from "../../components/Features";
import Footer from "../../components/Footer";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <HeroGeometric
          title1="Build your work space"
          title2="with AI-Hub"
          color1="#3B82F6"
          color2="#F0F9FF"
          speed={1}
        >
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
          >
            <Link 
              to="/login" 
              className="px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors shadow-lg hover:shadow-blue-500/25"
            >
              Get Started
            </Link>
          </motion.div>
        </HeroGeometric>
        
        <Features />
      </main>
      <Footer />
    </div>
  );
}




