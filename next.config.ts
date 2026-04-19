import type { NextConfig } from "next";

const isStaticExport = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  basePath: isStaticExport ? basePath : undefined,
  assetPrefix: isStaticExport && basePath ? `${basePath}/` : undefined,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
