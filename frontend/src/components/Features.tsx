import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, Lock, Server, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import { cn } from '@/lib/utils';

// Loops through `count` states every `ms`. Reduced motion holds the last, most complete state.
function useTick(count: number, ms: number) {
  const reduceMotion = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setTick((t) => (t + 1) % count), ms);
    return () => clearInterval(id);
  }, [count, ms, reduceMotion]);

  return reduceMotion ? count - 1 : tick;
}

function Caret() {
  return <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-blue-500" />;
}

const PROVIDERS = [
  { name: 'Anthropic', color: 'bg-[#D97757]' },
  { name: 'OpenAI', color: 'bg-teal-500' },
  { name: 'Google', color: 'bg-blue-500' },
  { name: 'Groq', color: 'bg-[#F55036]' },
];

const REPLY =
  "Server-Sent Events keep one HTTP response open, so the server can push every token to your browser the moment it's ready.".split(' ');

// Each model streams the reply, then holds it for a beat before the next one takes over.
const TICKS_PER_MODEL = REPLY.length + 12;

function ModelsDemo() {
  const tick = useTick(PROVIDERS.length * TICKS_PER_MODEL, 90);
  const active = Math.floor(tick / TICKS_PER_MODEL);
  const words = (tick % TICKS_PER_MODEL) + 1;

  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="mx-auto flex w-fit flex-wrap justify-center rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {PROVIDERS.map((provider, i) => (
          <div key={provider.name} className="relative px-2.5 py-1.5 text-[11px] font-medium sm:px-3 sm:text-xs">
            {i === active && (
              <motion.span
                layoutId="model-pill"
                className="absolute inset-0 rounded-full bg-zinc-100 dark:bg-zinc-800"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span
              className={cn(
                'relative flex items-center gap-1.5 transition-colors',
                i === active ? 'text-zinc-900 dark:text-white' : 'text-zinc-500',
              )}
            >
              <span className={cn('size-1.5 rounded-full', provider.color)} />
              {provider.name}
            </span>
          </div>
        ))}
      </div>

      <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2 text-sm text-white">
        Explain SSE in one sentence.
      </div>

      <div className="flex gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-500',
            PROVIDERS[active].color,
          )}
        >
          <Sparkles className="size-3.5" />
        </span>
        {/* The invisible full reply reserves its height, so the card doesn't jump as words stream in. */}
        <p className="grid text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <span className="invisible col-start-1 row-start-1">{REPLY.join(' ')}</span>
          <span className="col-start-1 row-start-1">
            {REPLY.slice(0, words).join(' ')}
            {words < REPLY.length && <Caret />}
          </span>
        </p>
      </div>
    </div>
  );
}

// Signed file links last 15 minutes.
const LINK_SECONDS = 15 * 60;

function PrivacyDemo() {
  // Counts down from 14:59 and wraps to 15:00 as the link is re-signed; reduced motion holds 15:00.
  const left = LINK_SECONDS - ((useTick(LINK_SECONDS, 1000) + 1) % LINK_SECONDS);
  const expiresIn = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const rows = [
    ['model', 'claude-sonnet-5'],
    ['tokens', '812'],
    ['duration', '1.24s'],
    ['file', `link expires ${expiresIn}`],
  ];

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 font-mono text-xs shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-zinc-900 dark:text-white">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          POST /chats/messages
        </span>
        <span className="text-zinc-400">200</span>
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([key, value]) => (
          <div key={key} className="flex gap-4">
            <dt className="w-16 shrink-0 text-zinc-400">{key}</dt>
            <dd className="text-zinc-700 tabular-nums dark:text-zinc-300">{value}</dd>
          </div>
        ))}
        <div className="flex items-center gap-4">
          <dt className="w-16 shrink-0 text-zinc-400">message</dt>
          <dd className="flex flex-1 items-center gap-2">
            <span
              className="h-3 flex-1 rounded-sm text-zinc-200 dark:text-zinc-700"
              style={{ backgroundImage: 'repeating-linear-gradient(135deg, currentColor 0 4px, transparent 4px 8px)' }}
            />
            <span className="flex shrink-0 items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Lock className="size-3" />
              never logged
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

const COMMANDS = ['cp .env.example .env', 'docker compose up -d'];

const SERVICES = [
  ['postgres', 'healthy'],
  ['redis', 'healthy'],
  ['app', 'healthy'],
  ['scheduler', 'started'],
  ['caddy', 'serving HTTPS'],
];

function SelfHostDemo() {
  // One line per tick; the extra ticks hold the finished log before it replays.
  const shown = useTick(COMMANDS.length + SERVICES.length + 4, 550) + 1;

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 font-mono text-xs shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="ml-2 text-zinc-500">deploy@your-server</span>
      </div>
      {/* Lines not yet printed stay invisible rather than absent, so the terminal keeps its height. */}
      <div className="space-y-1.5 p-4">
        {COMMANDS.map((command, i) => (
          <div key={command} className={cn(i >= shown && 'invisible')}>
            <span className="text-zinc-500">$ </span>
            <span className="text-zinc-100">{command}</span>
          </div>
        ))}
        {SERVICES.map(([service, status], i) => (
          <div key={service} className={cn('flex items-center gap-3', COMMANDS.length + i >= shown && 'invisible')}>
            <Check className="size-3.5 text-emerald-400" />
            <span className="w-20 text-zinc-300">{service}</span>
            <span className="text-zinc-500">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Feature {
  // The section heading while this feature is open; its second half is shown in the gradient.
  heading: [string, string];
  icon: LucideIcon;
  title: string;
  description: string;
  demo: ReactNode;
}

const FEATURES: Feature[] = [
  {
    heading: ['Every model.', 'One chat.'],
    icon: Sparkles,
    title: 'Any model, any message',
    description:
      'Pick a model from Anthropic, OpenAI, Google or Groq for each message. Replies stream in while they are written, not after.',
    demo: <ModelsDemo />,
  },
  {
    heading: ['Your words.', 'Stay yours.'],
    icon: ShieldCheck,
    title: 'Your words stay yours',
    description:
      'Files live in private storage behind links that expire in 15 minutes. Our logs keep the model, tokens and timing, never what you wrote.',
    demo: <PrivacyDemo />,
  },
  {
    heading: ['Your server.', 'Your rules.'],
    icon: Server,
    title: 'Deploy it on your own server',
    description:
      'AI-Hub is open source. Run the whole stack on your own server with Docker Compose, your own API keys and automatic HTTPS.',
    demo: <SelfHostDemo />,
  },
];

// How long each feature stays open before the list moves on by itself.
const AUTO_ADVANCE_MS = 7000;

export default function Features() {
  const showcaseRef = useRef<HTMLDivElement>(null);
  const inView = useInView(showcaseRef, { amount: 0.4 });
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  // Picking a feature stops the auto-advance for good, so it never moves away from what the user chose.
  const [autoAdvance, setAutoAdvance] = useState(true);
  const playing = autoAdvance && inView && !reduceMotion;

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % FEATURES.length), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [active, playing]);

  return (
    <section id="features" className="relative overflow-hidden py-24 sm:py-32">
      {/* Centered below the top edge, so the dots fade in instead of starting at the seam with the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-zinc-300 dark:text-zinc-800"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 60% 40% at 50% 35%, black, transparent)',
        }}
      />

      <MotionConfig reducedMotion="user">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="mb-5 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Sparkles className="size-3.5" />
                Features
              </span>
            </div>
            <SectionHeading
              title={FEATURES[active].heading[0]}
              highlight={FEATURES[active].heading[1]}
              description="Talk to the best AI models in one private place, on our servers or your own."
            />
          </motion.div>

          <motion.div
            ref={showcaseRef}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mt-16 grid items-center gap-8 lg:grid-cols-5 lg:gap-12"
          >
            <div className="space-y-2 lg:col-span-2">
              {FEATURES.map(({ icon: Icon, title, description }, i) => (
                <button
                  key={title}
                  type="button"
                  aria-expanded={i === active}
                  onClick={() => {
                    setActive(i);
                    setAutoAdvance(false);
                  }}
                  className={cn(
                    'relative w-full overflow-hidden rounded-2xl p-5 text-left transition-colors',
                    i === active
                      ? 'bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800'
                      : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                        i === active
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <span
                      className={cn(
                        'font-semibold transition-colors',
                        i === active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400',
                      )}
                    >
                      {title}
                    </span>
                  </span>
                  <AnimatePresence initial={false}>
                    {i === active && (
                      <motion.span
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="block overflow-hidden pl-12 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
                      >
                        <span className="block pt-2">{description}</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Remounts, and so restarts, whenever the timer restarts: on a new feature or on scrolling back. */}
                  {i === active && playing && (
                    <motion.span
                      aria-hidden
                      className="absolute inset-x-5 bottom-0 h-0.5 origin-left rounded-full bg-blue-500"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
              }}
              className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-2 shadow-xs lg:col-span-3 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              {/* Cursor spotlight, positioned by the --x/--y set on mouse move. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: 'radial-gradient(400px circle at var(--x) var(--y), rgb(59 130 246 / 0.1), transparent 45%)' }}
              />
              <div
                aria-hidden
                className="relative flex h-80 items-center justify-center overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 sm:px-8 dark:border-zinc-800/60 dark:bg-zinc-950/60"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="flex w-full justify-center"
                  >
                    {FEATURES[active].demo}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </MotionConfig>
    </section>
  );
}
