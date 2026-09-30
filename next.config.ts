import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Request photos are sent with the save action. The default 1 MB cap
    // rejects a normal phone photo and the form then reports a connection error.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
