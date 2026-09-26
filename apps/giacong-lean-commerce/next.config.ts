import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.177"],
  output: "standalone",
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async redirects() {
    return [
      {
        source: "/7047-2",
        destination: "/gia-cong-nuoc-chanh-mat-ong",
        permanent: true,
      },
      {
        source: "/mua-hang",
        destination: "/san-pham",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
