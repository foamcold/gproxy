import axios from 'axios';

// @ts-ignore
const API_BASE_URL = import.meta.env.VITE_API_V1_STR || '/api/v1';

// Axios实例
const apiClient = axios.create({
    baseURL: API_BASE_URL,
});

// 请求拦截器 - 自动添加认证token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器 - 统一错误处理
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token过期或无效，跳转登录
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export { API_BASE_URL };
export default apiClient;
