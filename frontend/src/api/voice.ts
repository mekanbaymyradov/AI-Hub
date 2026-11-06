import { apiClient } from "./axiosInstance";
import { type TranscriptionResponse } from "./types";

export const voiceApi = {
  transcribe: async (audio: Blob, signal?: AbortSignal): Promise<string> => {
    const formData = new FormData();
    formData.append("file", audio);

    const response = await apiClient.post<TranscriptionResponse>("/voice/transcriptions", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      signal,
    });
    return response.data.text;
  },
};
