import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  async redirects() {
  return [
    {
      source: "/result",
      has: [
        {
          type: "query",
          key: "websiteId",
        },
      ],
      destination: "/result",
      permanent: false,
    },
  ];
  },

  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "http://15.164.29.199:8080/:path*", 
      },
    ];
  },
};

export default nextConfig;
