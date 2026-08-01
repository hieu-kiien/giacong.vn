import type { NextConfig } from "next";

const bagistoProxyOrigin = process.env.BAGISTO_PROXY_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
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
  async rewrites() {
    if (!bagistoProxyOrigin) return [];

    return [
      {
        source: "/admin/:path*",
        destination: `${bagistoProxyOrigin}/admin/:path*`,
      },
      {
        source: "/api/b2b/:path*",
        destination: `${bagistoProxyOrigin}/api/b2b/:path*`,
      },
      {
        source: "/themes/admin/:path*",
        destination: `${bagistoProxyOrigin}/themes/admin/:path*`,
      },
      {
        source: "/storage/:path*",
        destination: `${bagistoProxyOrigin}/storage/:path*`,
      },
      {
        source: "/cache/:path*",
        destination: `${bagistoProxyOrigin}/cache/:path*`,
      },
    ];
  },
};

export default nextConfig;
