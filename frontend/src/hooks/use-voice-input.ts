import { useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@/api/errors";
import { voiceApi } from "@/api/voice";

export type VoiceInputState = "idle" | "starting" | "recording" | "transcribing";

// Formats the API accepts that browsers record, so the upload never depends on what the browser
// reports (Firefox can report none). Chrome and Firefox take WebM, Safari MP4.
const RECORDING_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"];
const recordingType =
  typeof MediaRecorder !== "undefined"
    ? RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    : undefined;

export const canRecordVoice = Boolean(recordingType && navigator.mediaDevices?.getUserMedia);

/** Record from the microphone on `toggle`, then pass what was said to `onText`, or why it failed to `onError`. */
export function useVoiceInput(onText: (text: string) => void, onError: (message: string) => void) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Leaving the chat mid-recording must still release the microphone, without transcribing.
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      recorder.onstop = null;
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = async () => {
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setState("idle");
      onError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser to use voice input."
          : "Couldn't start the microphone.",
      );
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: recordingType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      recorderRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      setState("transcribing");
      try {
        const text = await voiceApi.transcribe(new Blob(chunks, { type: recordingType }));
        if (text) onText(text);
      } catch (err) {
        onError(getErrorMessage(err, "Couldn't transcribe the recording."));
      } finally {
        setState("idle");
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
  };

  const toggle = () => {
    if (state === "recording") recorderRef.current?.stop();
    else if (state === "idle") void start();
  };

  return { state, toggle };
}
