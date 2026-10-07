import { BrainCircuit, Twitter, Github, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-bold text-neutral-900">AI-Hub</span>
            </div>
            <p className="text-sm text-neutral-500 mb-6">
              The all-in-one workspace for your AI workflows. Build, deploy, and scale with ease.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-neutral-400 hover:text-neutral-600">
                {/* <Twitter className="h-5 w-5" /> */}
              </a>
              <a href="#" className="text-neutral-400 hover:text-neutral-600">
                {/* <Github className="h-5 w-5" /> */}
              </a>
              <a href="#" className="text-neutral-400 hover:text-neutral-600">
                {/* <Linkedin className="h-5 w-5" /> */}
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 tracking-wider uppercase mb-4">Product</h3>
            <ul className="space-y-3 text-sm text-neutral-500">
              <li><a href="#features" className="hover:text-neutral-900">Features</a></li>
              <li><a href="#" className="hover:text-neutral-900">Pricing</a></li>
              <li><a href="#" className="hover:text-neutral-900">Integrations</a></li>
              <li><a href="#" className="hover:text-neutral-900">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 tracking-wider uppercase mb-4">Resources</h3>
            <ul className="space-y-3 text-sm text-neutral-500">
              <li><a href="#" className="hover:text-neutral-900">Documentation</a></li>
              <li><a href="#" className="hover:text-neutral-900">Blog</a></li>
              <li><a href="#" className="hover:text-neutral-900">Community</a></li>
              <li><a href="#" className="hover:text-neutral-900">Guides</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 tracking-wider uppercase mb-4">Legal</h3>
            <ul className="space-y-3 text-sm text-neutral-500">
              <li><a href="#" className="hover:text-neutral-900">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-neutral-900">Terms of Service</a></li>
              <li><a href="#" className="hover:text-neutral-900">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-neutral-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-neutral-400">
            &copy; {new Date().getFullYear()} AI-Hub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
