import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents stays off: with it on, every page hangs on Cloudflare Workers
  allowedDevOrigins: ["*.ngrok-free.app"],
  redirects() {
    return [
      {
        source: "/previous-life/fish-mongering",
        destination: "/previous-life/fishmongering",
        permanent: true,
      },
    ];
  },
  rewrites() {
    return [
      // archived Complex page, served from public/ at a clean URL
      {
        source: "/archive/how-ye-changed-pop-culture",
        destination: "/archive/how-ye-changed-pop-culture/index.html",
      },
      // archived Complex ad demos: one page, and ads.js picks the ad from the URL
      {
        source: "/archive/complex-ads/:demo(swagger|dell|timberland|banana-republic)",
        destination: "/archive/complex-ads/index.html",
      },
    ];
  },
};

export default nextConfig;
