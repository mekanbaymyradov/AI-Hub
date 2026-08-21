# Middleware

## Implement a Pure ASGI Middleware instead of `BaseHTTPMiddleware`

The `BaseHTTPMiddleware` (which is what `@app.middleware("http")` wraps) is the simplest way to create a middleware, but there is a performance penalty when using it. To avoid the performance penalty, you can implement a Pure ASGI middleware (though it is more complex to implement).
