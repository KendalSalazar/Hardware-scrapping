import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@hardware-scrapping/shared-types'],
};

export default nextConfig;
