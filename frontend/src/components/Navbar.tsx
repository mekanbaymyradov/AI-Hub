import { Link } from 'react-router-dom';
import { BrainCircuit, ArrowRight } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 shadow-sm border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-blue-600" />
            <Link to="/" className="text-xl font-bold text-neutral-900">
              AI-Hub
            </Link>
          </div>
          <nav className="hidden md:flex gap-6">
            <a href="#features" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">Features</a>
            <a href="#about" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
              Log in
            </Link>
            <Link 
              to="/login" 
              className="group flex items-center gap-2 px-6 py-2.5 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
