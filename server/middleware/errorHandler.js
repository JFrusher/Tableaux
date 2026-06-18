// Express recognises error middleware by its four-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || (err instanceof SyntaxError ? 400 : 500)
  // Log only the message + stack, never the whole error object — it can carry
  // request bodies, headers or DB payloads that may contain personal data.
  if (status >= 500) console.error('[tableaux] server error:', err.message, '\n', err.stack)
  // Client errors (4xx) carry intentional, safe messages. Server errors (5xx)
  // must not leak internals (stack traces, DB details) in production.
  const isProd = process.env.NODE_ENV === 'production'
  const message =
    status >= 500 && isProd ? 'Internal server error' : err.message || 'Internal server error'
  res.status(status).json({ error: message })
}

export function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` })
}
