import { useEffect, useRef } from "react";

import { rms } from "@/lib/audio";
import { cn } from "@/lib/utils";

const BAR_WIDTH = 2;
const BAR_GAP = 2;
const BAR_MS = 50;

interface VoiceWaveformProps {
  // Null freezes the last frame, as while the recording is transcribed.
  analyser: AnalyserNode | null;
  className?: string;
}

/** Draw the microphone's level as bars that scroll in from the right, in the element's text colour. */
export function VoiceWaveform({ analyser, className }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !analyser) return;

    const samples = new Float32Array(analyser.fftSize);
    const levels: number[] = [];
    let frame = 0;
    let lastBarAt = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastBarAt < BAR_MS) return;
      lastBarAt = now;

      const { clientWidth: width, clientHeight: height } = canvas;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }

      analyser.getFloatTimeDomainData(samples);
      // The square root lifts quiet speech, so the bars move for a normal voice, not only a loud one.
      levels.push(Math.min(1, Math.sqrt(rms(samples)) * 2));
      const count = Math.floor(width / (BAR_WIDTH + BAR_GAP));
      if (levels.length > count) levels.splice(0, levels.length - count);
      // Silent slots still draw as dots, so the bar reads as a track from the start.
      while (levels.length < count) levels.unshift(0);

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = getComputedStyle(canvas).color;
      levels.forEach((level, i) => {
        const barHeight = Math.max(BAR_WIDTH, level * height);
        context.beginPath();
        context.roundRect(
          width - (count - i) * (BAR_WIDTH + BAR_GAP),
          (height - barHeight) / 2,
          BAR_WIDTH,
          barHeight,
          BAR_WIDTH / 2,
        );
        context.fill();
      });
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return <canvas ref={canvasRef} aria-hidden className={cn("block", className)} />;
}
