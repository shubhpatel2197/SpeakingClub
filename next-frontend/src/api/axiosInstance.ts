import axios from 'axios'
import { getAuthToken } from '../lib/authToken'

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send cookies
})

axiosInstance.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  response => response,
  error => {
    console.error('API error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default axiosInstance
