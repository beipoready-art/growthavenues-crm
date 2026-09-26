import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // KYC uploads are posted as multipart form data to API routes.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
