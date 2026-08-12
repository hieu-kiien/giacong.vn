import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  async redirects() {
    return [
      {
        source: "/dich-vu",
        destination: "/dich-vu-dong-goi-bao-jumbo",
        permanent: true,
      },
      {
        source: "/dich-vu/",
        destination: "/dich-vu-dong-goi-bao-jumbo",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
