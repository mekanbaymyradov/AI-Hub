import { Zap, Shield, Workflow, Layers } from 'lucide-react';

const features = [
  {
    name: 'Lightning Fast',
    description: 'Experience unparalleled speed with our optimized infrastructure, designed to keep your workflow uninterrupted.',
    icon: Zap,
  },
  {
    name: 'Secure & Private',
    description: 'Your data is encrypted end-to-end. We prioritize your privacy and ensure enterprise-grade security at every step.',
    icon: Shield,
  },
  {
    name: 'Unified Workflows',
    description: 'Bring all your AI tools into one cohesive environment. Say goodbye to context switching and siloed applications.',
    icon: Workflow,
  },
  {
    name: 'Seamless Integration',
    description: 'Connect with your favorite platforms effortlessly. Our extensive API and pre-built connectors do the heavy lifting.',
    icon: Layers,
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-zinc-50 dark:bg-zinc-900/40 border-t border-b border-zinc-200/60 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Everything you need to build faster
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            AI-Hub provides a comprehensive suite of tools to supercharge your development process and bring your ideas to life.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div 
              key={feature.name} 
              className="bg-white dark:bg-zinc-900/80 p-6 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800/80 hover:border-blue-500/40 dark:hover:border-blue-500/40 hover:shadow-lg dark:hover:shadow-blue-950/20 transition-all duration-200"
            >
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 rounded-xl flex items-center justify-center mb-6 border border-blue-100 dark:border-blue-900/40">
                <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                {feature.name}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
