# API Discovery Approach

> **Note:** This document describes the high-level approach used to discover and document the Watts Home API. The actual captured traffic and detailed reverse engineering notes have been removed from the repository.

## Overview

The Watts Home API was discovered through network traffic analysis using mitmproxy to intercept HTTPS traffic between the Watts Home mobile app and the cloud API.

## Tools Used

- **mitmproxy**: HTTP/HTTPS proxy for intercepting and analyzing network traffic
- **mitmweb**: Web-based interface for mitmproxy (easier to use than CLI)

## High-Level Process

1. **Setup mitmproxy**: Configured mitmproxy as a proxy server on a development machine
2. **Configure mobile device**: Set up iPhone to route traffic through mitmproxy proxy
3. **Install certificate**: Installed mitmproxy's CA certificate on iPhone to decrypt HTTPS traffic
4. **Capture traffic**: Performed various actions in the Watts Home app while mitmproxy captured all requests/responses
5. **Analyze flows**: Examined captured HTTP requests and responses to understand:
   - Authentication flow (Azure AD B2C OAuth 2.0)
   - API endpoints and base URLs
   - Request/response formats
   - Required headers and authentication tokens
   - Device control mechanisms

## Key Discoveries

- **API Base**: `https://home.watts.com/api/`
- **Authentication**: Azure AD B2C OAuth 2.0 with PKCE
- **Protocol**: REST API with JSON request/response bodies
- **Token Type**: JWT Bearer tokens
- **Token Lifetime**: 15 minutes (access), 90 days (refresh)

## Documentation

All discovered API endpoints, authentication flows, and request/response formats are documented in:
- `docs/API_ENDPOINTS.md` - Complete API reference
- `docs/AUTHENTICATION.md` - Authentication flow details

## Re-capturing Traffic

If you need to capture new API flows in the future:

1. Install mitmproxy: `brew install mitmproxy` (macOS) or `pip install mitmproxy`
2. Start mitmproxy: `mitmweb` (web interface) or `mitmproxy -p 8080` (CLI)
3. Configure your device to use the proxy (Settings → Wi-Fi → Configure Proxy)
4. Install mitmproxy certificate: Visit `mitm.it` on your device
5. Enable certificate trust: Settings → General → About → Certificate Trust Settings
6. Capture traffic while using the Watts Home app
7. Export flows as needed for analysis

## Security Notes

- Never commit captured traffic files containing authentication tokens or personal information
- Always redact sensitive data (emails, tokens, device IDs) from documentation
- Keep authentication credentials secure and never commit them to version control
