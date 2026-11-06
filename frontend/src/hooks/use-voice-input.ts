import axios from "axios";
import { useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@/api/errors";
import { voiceApi } from "@/api/voice";
import { rms } from "@/lib/audio";

export type VoiceInputState = "idle" | "starting" | "recording" | "transcribing";

// Formats the API accepts that browsers record, so the upload never depends on what the browser
// reports (Firefox can report none). Chrome and Firefox take WebM, Safari MP4.
const RECORDING_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"];
const recordingType =
  typeof MediaRecorder !== "undefined"
    ? RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    : undefined;

export const canRecordVoice = Boolean(recordingType && navigator.mediaDevices?.getUserMedia);

// Groq converts everything to 16 kHz mono, so a higher bitrate only slows the upload.
const BITS_PER_SECOND = 32_000;
// About 1.2 MB at this bitrate, well under the API's 10 MiB.
const MAX_RECORDING_SECONDS = 5 * 60;
// Whisper makes up text like "Thank you." on silence and Groq bills at least 10 seconds a request,
// so a recording with less speech than this isn't sent.
const MIN_SPEECH_MS = 300;
// About -34 dBFS, above a quiet room once the browser's noise suppression has run.
const SPEECH_RMS = 0.02;
const SAMPLE_MS = 50;

interface Recording {
  stream: MediaStream;
  recorder: MediaRecorder;
  audioContext: AudioContext;
  timer: number;
  discard: boolean;
}

/** Return true when the same audio may succeed later: a network failure, a rate limit or a server error. */
function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 429 || status >= 500;
}

/** Dictate into the composer: record, check that something was said, transcribe and pass the text to `onText`. */
export function useVoiceInput(onText: (text: string) => void) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Kept after a failure that may not happen again, so a retry needs no new recording.
  const [failedAudio, setFailedAudio] = useState<Blob | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const uploadRef = useRef<AbortController | null>(null);
  const unmountedRef = useRef(false);

  const release = () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    clearInterval(recording.timer);
    recording.stream.getTracks().forEach((track) => track.stop());
    void recording.audioContext.close();
    setAnalyser(null);
  };

  // Leaving the chat mid-recording must still release the microphone, without transcribing.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (recordingRef.current) recordingRef.current.discard = true;
      release();
      uploadRef.current?.abort();
    };
  }, []);

  const transcribe = async (audio: Blob) => {
    const upload = new AbortController();
    uploadRef.current = upload;
    setState("transcribing");
    setError(null);
    setFailedAudio(null);
    try {
      const text = await voiceApi.transcribe(audio, upload.signal);
      if (text) onText(text);
      else setError("Didn't catch that. Try again.");
    } catch (err) {
      if (upload.signal.aborted) return;
      setError(getErrorMessage(err, "Couldn't transcribe the recording."));
      if (isRetryable(err)) setFailedAudio(audio);
    } finally {
      // Not after a cancel, which has already moved on and may have started a new recording.
      if (uploadRef.current === upload) {
        uploadRef.current = null;
        setState("idle");
      }
    }
  };

  const finish = () => {
    const recording = recordingRef.current;
    if (recording?.recorder.state === "recording") recording.recorder.stop();
  };

  const start = async () => {
    setError(null);
    setFailedAudio(null);
    setElapsed(0);
    setState("starting");
    // Created before the first await, since Safari only starts audio within the click.
    const audioContext = new AudioContext();

    let stream: MediaStream;
    try {
      // The browser's echo cancellation, noise suppression and gain control are on by default.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch (err) {
      void audioContext.close();
      setState("idle");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser to use voice input."
          : "Couldn't start the microphone.",
      );
      return;
    }
    if (unmountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      void audioContext.close();
      return;
    }

    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    audioContext.createMediaStreamSource(stream).connect(analyserNode);
    const samples = new Float32Array(analyserNode.fftSize);

    const recorder = new MediaRecorder(stream, {
      mimeType: recordingType,
      audioBitsPerSecond: BITS_PER_SECOND,
    });
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    let speechMs = 0;

    const recording: Recording = {
      stream,
      recorder,
      audioContext,
      discard: false,
      timer: window.setInterval(() => {
        analyserNode.getFloatTimeDomainData(samples);
        if (rms(samples) > SPEECH_RMS) speechMs += SAMPLE_MS;
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_RECORDING_SECONDS) finish();
      }, SAMPLE_MS),
    };

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      release();
      if (recording.discard) {
        setState("idle");
      } else if (speechMs < MIN_SPEECH_MS) {
        setState("idle");
        setError("Didn't hear anything. Check your microphone and try again.");
      } else {
        void transcribe(new Blob(chunks, { type: recordingType }));
      }
    };

    recordingRef.current = recording;
    recorder.start();
    setAnalyser(analyserNode);
    setState("recording");
  };

  const cancel = () => {
    const recording = recordingRef.current;
    if (recording) {
      recording.discard = true;
      recording.recorder.stop();
      return;
    }
    uploadRef.current?.abort();
    uploadRef.current = null;
    setState("idle");
  };

  const retry = () => {
    if (failedAudio) void transcribe(failedAudio);
  };

  const dismissError = () => {
    setError(null);
    setFailedAudio(null);
  };

  return {
    state,
    analyser,
    elapsed,
    error,
    canRetry: failedAudio !== null,
    start: () => void start(),
    finish,
    cancel,
    retry,
    dismissError,
  };
}
