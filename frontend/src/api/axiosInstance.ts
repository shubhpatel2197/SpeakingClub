import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send cookies
})

axiosInstance.interceptors.response.use(
  response => response,
  error => {
    console.error('API error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default axiosInstance