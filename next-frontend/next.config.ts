import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['app.local'],
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
}

export default nextConfig
