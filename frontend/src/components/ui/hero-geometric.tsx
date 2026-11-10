"use client";

import { lazy, Suspense, useState, useEffect } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { WebGLErrorBoundary } from "./webgl-error-boundary";

// three.js is most of the landing page's JavaScript, so the gradient loads
// apart and the headline doesn't wait for it.
const HeroGradientCanvas = lazy(() => import("./hero-gradient-canvas"));

const HERO_GEOMETRIC_FALLBACK_COLOR_1 = "#3B82F6";
const HERO_GEOMETRIC_FALLBACK_COLOR_2 = "#F0F9FF";
const HERO_GEOMETRIC_FALLBACK_BG = "#FFFFFF";
const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/;

function sanitizeHexColor(value: string, fallback: string) {
    const trimmed = value.trim();
    if (!HEX_COLOR_REGEX.test(trimmed)) return fallback;
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

interface HeroGeometricProps extends React.ComponentPropsWithoutRef<"div"> {
    title1?: string;
    title2?: string;
    description?: string;
    color1?: string;
    color2?: string;
    bgColor?: string;
    speed?: number;
}

const HERO_HEADLINE_CLASS =
    "pb-[0.08em] text-3xl min-[400px]:text-4xl sm:text-6xl md:text-[8cqi] lg:text-[6cqi] leading-[0.96] tracking-tighter font-bold text-zinc-900 dark:text-white break-words text-center";

export default function HeroGeometric({
    title1,
    title2,
    description,
    color1 = "#3B82F6",
    color2 = "#F0F9FF",
    bgColor = "#FFFFFF",
    speed = 1,
    className,
    ...props
}: HeroGeometricProps) {
    const [canvasReady, setCanvasReady] = useState(false);
    const reduceMotion = useReducedMotion();
    const background = sanitizeHexColor(bgColor, HERO_GEOMETRIC_FALLBACK_BG);

    useEffect(() => {
        const timer = setTimeout(() => {
            setCanvasReady(true);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <MotionConfig reducedMotion="user">
        <div
            className={cn("relative w-full min-h-dvh flex flex-col items-center overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors duration-200", className)}
            style={{
                containerType: "inline-size",
                ...props.style
            }}
            {...props}
        >
            {}
            <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
                <WebGLErrorBoundary>
                    <Suspense fallback={null}>
                        <HeroGradientCanvas
                            color1={sanitizeHexColor(color1, HERO_GEOMETRIC_FALLBACK_COLOR_1)}
                            color2={sanitizeHexColor(color2, HERO_GEOMETRIC_FALLBACK_COLOR_2)}
                            bgColor={background}
                            speed={speed}
                            still={reduceMotion === true}
                            onCreated={() => {

                                setTimeout(() => setCanvasReady(true), 100);
                            }}
                        />
                    </Suspense>
                </WebGLErrorBoundary>
            </div>
            {/* Fades the shader into the page so the next section has no hard edge. */}
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-0 h-1/4 pointer-events-none"
                style={{ background: `linear-gradient(to bottom, transparent, ${background})` }}
            />

            {}
            {(title1 || title2 || description) && (
                <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center pt-24 pb-12 sm:pt-28 sm:pb-16 md:pt-32 md:pb-24">
                    <div className="w-full max-w-[1200px] px-4 sm:px-6 flex flex-col items-center">
                        {}
                        <div className="flex flex-col items-center text-center gap-2 md:gap-4 mb-8 md:mb-12">
                            {title1 && (
                                <div className="overflow-hidden max-w-full flex justify-center">
                                    <motion.h1
                                        initial={{ y: "100%", opacity: 0 }}
                                        animate={canvasReady ? { y: "0%", opacity: 1 } : { y: "100%", opacity: 0 }}
                                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                                        className={HERO_HEADLINE_CLASS}
                                    >
                                        {title1}
                                    </motion.h1>
                                </div>
                            )}
                            {title2 && (
                                <div className="overflow-hidden max-w-full flex justify-center">
                                    <motion.h1
                                        initial={{ y: "100%", opacity: 0 }}
                                        animate={canvasReady ? { y: "0%", opacity: 1 } : { y: "100%", opacity: 0 }}
                                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                                        className={HERO_HEADLINE_CLASS}
                                    >
                                        {title2}
                                    </motion.h1>
                                </div>
                            )}
                        </div>

                        {}
                        {description && (
                            <div className="max-w-[480px] px-2 text-center mb-8">
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={canvasReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                                    transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                                    className="text-base sm:text-lg md:text-[1.35rem] leading-relaxed text-zinc-600 dark:text-zinc-400 font-normal"
                                >
                                    {description}
                                </motion.p>
                            </div>
                        )}
                        {}
                        {props.children}
                    </div>
                </div>
            )}
        </div>
        </MotionConfig>
    );
}
