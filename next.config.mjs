/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable Turbopack - use webpack instead
  // Turbopack can't handle absolute path imports in node_modules
  webpackBuildWorker: true,
  serverExternalPackages: [
    "groq-sdk",
    "@anthropic-ai/sdk",
    "@dome-api/sdk",
    "@polymarket/builder-relayer-client",
    "@polymarket/builder-signing-sdk",
  ],
};

export default nextConfig;
