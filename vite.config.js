import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const localApiRoutes = {
  '/api/games/search': () => import('./api/games/search.js'),
  '/api/games/game': () => import('./api/games/game.js'),
  '/api/tmdb/search': () => import('./api/tmdb/search.js'),
  '/api/tmdb/movie': () => import('./api/tmdb/movie.js'),
  '/api/tmdb/search-series': () => import('./api/tmdb/search-series.js'),
  '/api/tmdb/series': () => import('./api/tmdb/series.js'),
}

function localApiPlugin() {
  return {
    name: 'cliquebase-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost')
        const loadRoute = localApiRoutes[requestUrl.pathname]

        if (!loadRoute) {
          next()
          return
        }

        try {
          const mod = await loadRoute()
          const handler = mod.default
          let sent = false
          let statusCode = 200

          const response = {
            status(code) {
              statusCode = code
              return response
            },
            setHeader(name, value) {
              res.setHeader(name, value)
              return response
            },
            json(payload) {
              if (sent) return response
              sent = true
              res.statusCode = statusCode
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(payload))
              return response
            },
            send(payload) {
              if (sent) return response
              sent = true
              res.statusCode = statusCode
              if (typeof payload === 'object') {
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify(payload))
              } else {
                res.end(String(payload ?? ''))
              }
              return response
            },
            end(payload) {
              if (sent) return response
              sent = true
              res.statusCode = statusCode
              res.end(payload)
              return response
            },
          }

          await handler({
            method: req.method,
            headers: req.headers,
            query: Object.fromEntries(requestUrl.searchParams.entries()),
            url: req.url,
          }, response)

          if (!sent) response.end()
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error?.message || 'Local API route failed' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [localApiPlugin(), react(), tailwindcss()],
    build: {
      chunkSizeWarningLimit: 1200,
    },
  }
})
