const createNextIntlPlugin = require("next-intl/plugin")

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  async redirects() {
    return [
      { source: "/due-dates/calendar", destination: "/due-dates", permanent: false },
      { source: "/due-dates/items", destination: "/due-dates", permanent: false },
      { source: "/due-dates/new", destination: "/due-dates", permanent: false },
      { source: "/due-dates/items/new", destination: "/due-dates", permanent: false },
      { source: "/due-dates/items/:id/edit", destination: "/due-dates/:id/edit", permanent: false },
      { source: "/due-dates/items/:id", destination: "/due-dates/:id", permanent: false },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
