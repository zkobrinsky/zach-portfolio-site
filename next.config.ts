import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents stays off: with it on, every page hangs on Cloudflare Workers
  allowedDevOrigins: ["*.ngrok-free.app"],
};

export default nextConfig;
