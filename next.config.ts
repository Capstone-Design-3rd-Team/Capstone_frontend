import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "http://15.164.29.199:8080/:path*", // HTTP라도 OK (Vercel → 백엔드)
      },
    ];
  },
};

export default nextConfig;
