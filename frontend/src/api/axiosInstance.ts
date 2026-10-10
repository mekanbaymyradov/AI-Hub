import axios from 'axios'


export const apiClient = axios.create({
  
  baseURL: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000',
  withCredentials: true, 
});


let currentAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

export const getAccessToken = () => currentAccessToken;


apiClient.interceptors.request.use(
  (config) => {
    if (currentAccessToken) {
      config.headers.Authorization = `Bearer ${currentAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        
        const { data } = await axios.post('/auth/token/refresh', {}, {
          baseURL: apiClient.defaults.baseURL,
          withCredentials: true
        });

        const newAccessToken = data.access_token;
        setAccessToken(newAccessToken);

        
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        
        setAccessToken(null);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
