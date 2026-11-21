export function securityHeaders(embedded = false, development = false) {
  const policy = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'",
    // Framework hydration and the chart's inline styles require these allowances.
    // External scripts, eval in production, objects, and arbitrary frames are blocked.
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
    `connect-src 'self'${development ? ' ws: wss:' : ''}`, "worker-src 'self'", "form-action 'self'",
    embedded ? "frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://chat.openai.com" : "frame-ancestors 'none'",
  ].join('; ');
  return {
    'Content-Security-Policy': policy,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    ...(embedded ? {} : {'X-Frame-Options': 'DENY'}),
  };
}
