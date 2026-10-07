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
    <section id="features" className="py-24 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Everything you need to build faster
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            AI-Hub provides a comprehensive suite of tools to supercharge your development process and bring your ideas to life.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div 
              key={feature.name} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                <feature.icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                {feature.name}
              </h3>
              <p className="text-neutral-600 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
