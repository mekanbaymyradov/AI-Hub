/** Return the root mean square of PCM samples in [-1, 1]: 0 is silence, speech is roughly 0.02 to 0.3. */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}
