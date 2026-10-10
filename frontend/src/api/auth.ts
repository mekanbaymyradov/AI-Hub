import { apiClient, setAccessToken } from './axiosInstance';
import { type OTPRequest, type OTPVerify, type Token, type UserPublic, type UserUpdate } from './types';

export const authApi = {
  requestOtp: async (data: OTPRequest): Promise<void> => {
    await apiClient.post('/auth/otp/request', data);
  },

  verifyOtp: async (data: OTPVerify): Promise<Token> => {
    const response = await apiClient.post<Token>('/auth/otp/verify', data);
    setAccessToken(response.data.access_token);
    return response.data;
  },

  refreshToken: async (): Promise<Token> => {
    const response = await apiClient.post<Token>('/auth/token/refresh');
    setAccessToken(response.data.access_token);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    setAccessToken(null);
  },

  getCurrentUser: async (): Promise<UserPublic> => {
    const response = await apiClient.get<UserPublic>('/auth/me');
    return response.data;
  },

  updateCurrentUser: async (data: UserUpdate): Promise<UserPublic> => {
    const response = await apiClient.patch<UserPublic>('/auth/me', data);
    return response.data;
  },

  setAvatar: async (file: File): Promise<UserPublic> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.put<UserPublic>('/auth/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  removeAvatar: async (): Promise<void> => {
    await apiClient.delete('/auth/me/avatar');
  }
};
