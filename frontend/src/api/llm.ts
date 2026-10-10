import { apiClient } from './axiosInstance';
import { type ModelPublic } from './types';

export const llmApi = {
  getModels: async (): Promise<ModelPublic[]> => {
    const response = await apiClient.get<ModelPublic[]>('/llms/models');
    return response.data;
  }
};
