import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.177"],
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/mua-hang",
        destination: "/san-pham",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
