import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Replace the __PUBLIC_URL__ token in index.html with the deploy origin (set as
// a build arg / env var per environment). Runs as a `pre` transform so the real
// value is in place before Vite's HTML/URL processing. A non-`%` token is used
// deliberately: Vite's built-in %ENV% replacement would error on an undefined
// var (malformed-URI in href/content attrs). Falls back to '' when unset.
function publicUrlHtmlPlugin(publicUrl) {
  return {
    name: 'tableaux-public-url-html',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('__PUBLIC_URL__', publicUrl),
    },
  }
}

// Emit robots.txt (always) and sitemap.xml (only when a public URL is known —
// both need an absolute origin) at build time so they share one source of
// truth with the meta tags. User-generated /share and /seat links are excluded.
function seoFilesPlugin(publicUrl) {
  return {
    name: 'tableaux-seo-files',
    generateBundle() {
      const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /share/',
        'Disallow: /seat/',
        ...(publicUrl ? [`Sitemap: ${publicUrl}/sitemap.xml`] : []),
        '',
      ].join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })

      if (publicUrl) {
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${publicUrl}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const publicUrl = (env.VITE_PUBLIC_URL || '').replace(/\/$/, '')
  return {
    plugins: [react(), publicUrlHtmlPlugin(publicUrl), seoFilesPlugin(publicUrl)],
    build: {
      rollupOptions: {
        output: {
          // Split large vendors into their own chunks for better caching and to
          // keep the main bundle lean.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Allows the client to call /api/* without hardcoding the origin in dev.
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
