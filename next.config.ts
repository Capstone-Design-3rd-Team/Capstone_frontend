import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "https://15.164.29.199:8080/:path*", 
      },
    ];
  },
};

export default nextConfig;
