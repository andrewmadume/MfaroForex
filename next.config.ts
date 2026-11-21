import { securityHeaders } from './lib/security-headers';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {return [{source: '/:path*', headers: Object.entries(securityHeaders(false, process.env.NODE_ENV === 'development')).map(([key,value])=>({key,value}))}];}
};

export default nextConfig;
