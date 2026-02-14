import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  
  // CRITICAL: Generate unique build ID for each deployment
  // This ensures browsers fetch new assets after each deployment
  // Without this, browsers may cache old build files even with no-cache headers
  // ONLY in production - development mode doesn't use build files
  generateBuildId: async () => {
    // In development, return null to prevent using build files
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    // Use git commit hash if available (best for tracking)
    if (process.env.GIT_COMMIT_SHA) {
      return `build-${process.env.GIT_COMMIT_SHA}`;
    }
    // Fallback to timestamp for unique builds
    return `build-${Date.now()}`;
  },
  
  // Allow cross-origin requests in development (for sponsar access)
  allowedDevOrigins: [
    "192.168.1.2",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ],
  
  // Performance optimizations (only in production)
  compress: process.env.NODE_ENV === 'production',
  
  // Production optimizations
  reactStrictMode: true,
  
  // Enable SWC minification for better performance (Next.js 16+ uses SWC by default)
  // SWC is faster than Terser and produces smaller bundles
  
  // Image optimization - fewer sizes to reduce memory and work
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 828, 1080, 1200],
    imageSizes: [16, 32, 64, 128],
    qualities: [75, 85],
    minimumCacheTTL: 0,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Safari/iOS: Ensure images load properly
    unoptimized: true, // Disable Next.js optimization to prevent 400 errors
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/**',
      },
    ],
  },
  
  // Experimental features for performance
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-icons',
    ],
    // Enable partial prerendering for better performance
    ppr: false, // Can enable when stable
  },
  
  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  // In development mode (npm run dev), Turbopack compiles on-the-fly and doesn't use .next build files
  // Build files (.next/) are only created during `npm run build` for production
  // Development always uses source files, production uses build files
  // CRITICAL: In development, .next directory is ignored - all compilation is in-memory via Turbopack
  turbopack: {
    // Ensure Turbopack doesn't write to .next in development
    ...(process.env.NODE_ENV === 'development' ? { 
      // Development-specific Turbopack config
    } : {}),
  },
  
  // Development vs Production behavior:
  // - Development (npm run dev): Uses Turbopack to compile on-the-fly from source files
  //   No build files (.next/) are used - always compiles from src/ directory
  // - Production (npm run build && npm start): Uses pre-built files from .next/ directory
  //   Build files are created during `npm run build` and used by `npm start`
  
  // Light footprint: keep 2 pages in memory for instant back, dispose after 15s idle
  onDemandEntries: {
    maxInactiveAge: 15000,
    pagesBufferLength: 2,
  },
  
  // Headers for security and NO CACHING
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://analytics.tiktok.com https://*.tiktok.com https://vercel.live https://*.vercel.live https://*.vercel.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data: https://analytics.tiktok.com https://*.tiktok.com; connect-src 'self' https://analytics.tiktok.com https://*.tiktok.com https://*.tiktokw.us https://*.tiktokcdn.com https://*.byteoversea.com https://*.ibyteimg.com https://*.snssdk.com https://*.muscdn.com https://ads.tiktok.com https://vercel.live https://*.vercel.live https://*.vercel.com https://*.vercel.app wss://*.vercel.live wss://*.vercel.com; frame-src 'self' https://vercel.live https://*.vercel.live https://*.vercel.com; frame-ancestors 'none';"
      },
      // NO CACHING - Always fetch fresh
      {
        key: 'Cache-Control',
        value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
      {
        key: 'Pragma',
        value: 'no-cache',
      },
      {
        key: 'Expires',
        value: '0',
      },
    ];

    // Add HSTS only in production
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      });
    }
    
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Cache static assets for performance (reduces function invocations on free hosting)
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Serve uploaded images from public/uploads/
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, must-revalidate',
          },
        ],
      },
    ];
  },
  
  // Webpack optimizations (ONLY for production builds)
  // Development mode uses Turbopack and doesn't use webpack or .next files
  webpack: (config, { isServer, dir, dev }) => {
    // Skip webpack modifications in development - Turbopack handles it
    if (dev || process.env.NODE_ENV === 'development') {
      return config;
    }
    // Fix module resolution to use project directory instead of parent directory
    // Only modify if resolve exists and we're not using Turbopack
    if (config.resolve && dir) {
      const existingModules = Array.isArray(config.resolve.modules) 
        ? config.resolve.modules 
        : config.resolve.modules 
          ? [config.resolve.modules] 
          : [];
      
      // Ensure node_modules from project directory is included
      const projectNodeModules = path.join(dir, 'node_modules');
      if (!existingModules.includes(projectNodeModules) && !existingModules.includes('node_modules')) {
        config.resolve.modules = [
          ...existingModules,
          'node_modules',
          projectNodeModules,
        ];
      }
    }

    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
            },
            reactIcons: {
              test: /[\\/]node_modules[\\/]react-icons[\\/]/,
              name: 'react-icons',
              priority: 20,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
