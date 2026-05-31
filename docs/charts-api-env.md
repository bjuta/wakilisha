# WAKILISHA Charts API — Environment Variables

This document describes all environment variables required for the chart ingestion system and public charts API.

---

## Core Variables

### `VITE_CHARTS_INGESTION_MODE`
**Controls which adapter the admin ingestion studio uses.**
- `"mock"` (default) — Uses localStorage-backed mock data. No backend required.
- `"wordpress"` — Routes all API calls to the WordPress REST API.

```bash
# For local development with mock data
VITE_CHARTS_INGESTION_MODE=mock

# For testing against a real WordPress backend
VITE_CHARTS_INGESTION_MODE=wordpress
```

### `VITE_CHARTS_PUBLIC_MODE`
**Controls which adapter the public chart consumer pages use.**
- `"mock"` (default) — Uses mock data for chart directory, editions, and track history.
- `"wordpress"` — Routes all public API calls to the WordPress REST API.

```bash
VITE_CHARTS_PUBLIC_MODE=mock
```

### `VITE_WAKILISHA_WP_API_BASE`
**The base URL for the WordPress REST API endpoints.**
- Default: `/wp-json/wakilisha/v1`
- When the React app is embedded in WordPress as a plugin, this can be relative.
- When the React app is standalone, this must be an absolute URL.

```bash
# WordPress-embedded (same origin)
VITE_WAKILISHA_WP_API_BASE=/wp-json/wakilisha/v1

# Standalone dev server pointing to local WordPress
VITE_WAKILISHA_WP_API_BASE=http://localhost:8080/wp-json/wakilisha/v1

# Production
VITE_WAKILISHA_WP_API_BASE=https://wakilisha.com/wp-json/wakilisha/v1
```

---

## WordPress Nonce

The WordPress adapter automatically reads the REST nonce from the global window object:

```javascript
window.WAKILISHA_REST_NONCE
```

This must be injected by the WordPress plugin that embeds the React app. Example in PHP:

```php
wp_localize_script('wakilisha-charts-app', 'WAKILISHA_REST_NONCE', wp_create_nonce('wp_rest'));
```

If the nonce is not available, the adapter will still make requests but may receive 403 errors for authenticated endpoints.

---

## Environment Configuration Examples

### Local Development (Mock Mode)
```env
VITE_CHARTS_INGESTION_MODE=mock
VITE_CHARTS_PUBLIC_MODE=mock
# VITE_WAKILISHA_WP_API_BASE is optional in mock mode
```

### Local Development (WordPress Mode)
```env
VITE_CHARTS_INGESTION_MODE=wordpress
VITE_CHARTS_PUBLIC_MODE=wordpress
VITE_WAKILISHA_WP_API_BASE=http://localhost:8080/wp-json/wakilisha/v1
```

### Staging
```env
VITE_CHARTS_INGESTION_MODE=wordpress
VITE_CHARTS_PUBLIC_MODE=wordpress
VITE_WAKILISHA_WP_API_BASE=https://staging.wakilisha.com/wp-json/wakilisha/v1
```

### Production
```env
VITE_CHARTS_INGESTION_MODE=wordpress
VITE_CHARTS_PUBLIC_MODE=wordpress
VITE_WAKILISHA_WP_API_BASE=/wp-json/wakilisha/v1
```

---

## CORS Requirements

When the React app is served from a different origin than WordPress, the WordPress backend must send appropriate CORS headers:

```php
// In WordPress plugin
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        header('Access-Control-Allow-Origin: ' . esc_url_raw(get_frontend_origin()));
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        return $value;
    });
});
```

---

## Adapter Mode Detection

The React app detects the current mode at runtime:

1. `client.ts` reads `import.meta.env.VITE_CHARTS_INGESTION_MODE`
2. If `"wordpress"`, all admin ingestion calls route through `wpAdapter.ts`
3. If `"mock"` (default), all calls use `api.ts` with localStorage

The Integration Map page at `/admin/charts/integration-map` displays the current mode and a diagnostics panel.

---

## Health Check Endpoint

When in WordPress mode, the Integration Map page can test connectivity:

```
GET /wp-json/wakilisha/v1/charts/health
```

Expected response:
```json
{
  "ok": true,
  "plugin": "wakilisha",
  "charts_ingestion": true,
  "version": "1.0.0"
}
```

---

## Notes

- **Never commit `.env` files with real API keys or credentials.**
- **Mock mode is completely offline.** All data lives in localStorage.
- **WordPress mode requires the plugin to be installed and activated.**
- **The public charts client is separate from the admin ingestion client.** They can run in different modes.
- **Build-time only.** Vite env variables are baked at build time. To change mode, rebuild the app.