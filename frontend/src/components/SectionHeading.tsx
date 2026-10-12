import { AnimatePresence, motion } from 'framer-motion';

interface SectionHeadingProps {
  title: string;
  highlight: string;
  description: string;
}

export default function SectionHeading({ title, highlight, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-white">
        {/* Keyed by the text, so a changed heading fades out and the new one fades in. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${title} ${highlight}`}
            className="block"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {title}{' '}
            <span className="bg-linear-to-r whitespace-nowrap from-blue-600 to-violet-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-violet-400">
              {highlight}
            </span>
          </motion.span>
        </AnimatePresence>
      </h2>
      <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}
