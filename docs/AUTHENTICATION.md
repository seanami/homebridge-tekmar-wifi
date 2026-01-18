# Authentication Documentation

> **Status:** 🟢 DOCUMENTED - Fully reverse engineered!
> 
> **Last Updated:** 2026-01-18

This document details the authentication mechanism used by the Watts Home API.

---

## Authentication Flow

### Overview

**The Watts Home API uses Azure AD B2C OAuth 2.0 with PKCE (Proof Key for Code Exchange)**

```
User Flow:
1. App initiates OAuth flow with PKCE challenge
2. User enters credentials on Azure AD B2C login page
3. Azure AD B2C validates credentials
4. Redirects with authorization code
5. App exchanges code for tokens (with PKCE verifier)
6. Server returns access_token, id_token, and refresh_token
7. App stores tokens securely
8. App includes access_token in Authorization header
9. Access token expires after 15 minutes
10. App uses refresh_token to get new access_token
```

---

## OAuth 2.0 Endpoints

### Authorization Endpoint

```
https://login.watts.io/tfp/wattsb2cap02.onmicrosoft.com/B2C_1A_Residential_UnifiedSignUpOrSignIn/oauth2/v2.0/authorize
```

**Parameters:**
- `client_id`: `c832c38c-ce70-4ebc-83b6-b4548083ac90`
- `scope`: `https://wattsb2cap02.onmicrosoft.com/wattsapiresi/manage offline_access openid profile`
- `response_type`: `code`
- `redirect_uri`: `msalc832c38c-ce70-4ebc-83b6-b4548083ac90://auth`
- `code_challenge`: (PKCE challenge, base64url encoded)
- `code_challenge_method`: `S256`
- `prompt`: `login`

### Token Endpoint

```http
POST /tfp/wattsb2cap02.onmicrosoft.com/B2C_1A_Residential_UnifiedSignUpOrSignIn/oauth2/v2.0/token
Host: login.watts.io
Content-Type: application/x-www-form-urlencoded

client_id=c832c38c-ce70-4ebc-83b6-b4548083ac90
&scope=https://wattsb2cap02.onmicrosoft.com/wattsapiresi/manage+offline_access+openid+profile
&grant_type=authorization_code
&code=[AUTHORIZATION_CODE]
&redirect_uri=msalc832c38c-ce70-4ebc-83b6-b4548083ac90://auth
&code_verifier=[PKCE_VERIFIER]
&client_info=1
```

### Token Response

```json
{
  "access_token": "eyJhbGci...",
  "id_token": "eyJhbGci...",
  "token_type": "Bearer",
  "not_before": 1768717683,
  "expires_in": 900,
  "expires_on": 1768718583,
  "resource": "978b217d-e864-4f8e-a1d5-587ed65fa544",
  "scope": "https://wattsb2cap02.onmicrosoft.com/wattsapiresi/manage",
  "refresh_token": "eyJraWQ...",
  "refresh_token_expires_in": 7776000,
  "client_info": "eyJ1aWQi..."
}
```

---

## Token Details

### Access Token

- **Type:** JWT (JSON Web Token)
- **Location:** `Authorization: Bearer <token>` header
- **Lifetime:** **15 minutes** (900 seconds)
- **Algorithm:** RS256 (RSA Signature with SHA-256)
- **Issuer:** `https://login.watts.io/27985565-c196-47d0-84ea-60a525d3e970/v2.0/`
- **Audience:** `978b217d-e864-4f8e-a1d5-587ed65fa544`

### Decoded Access Token

```json
{
  "header": {
    "alg": "RS256",
    "kid": "DlH47qqXPRIjLhQlUq_GjjvX0CCTAJYHxWKbxhzxBj8",
    "typ": "JWT"
  },
  "payload": {
    "aud": "978b217d-e864-4f8e-a1d5-587ed65fa544",
    "iss": "https://login.watts.io/27985565-c196-47d0-84ea-60a525d3e970/v2.0/",
    "exp": 1768718583,
    "nbf": 1768717683,
    "sub": "db933c88-8744-469f-912c-272f36f29302",
    "oid": "db933c88-8744-469f-912c-272f36f29302",
    "email": "user@example.com",
    "name": "John Doe",
    "given_name": "John",
    "family_name": "Doe",
    "country": "United States",
    "emails": ["user@example.com"],
    "tid": "27985565-c196-47d0-84ea-60a525d3e970",
    "tfp": "B2C_1A_Residential_UnifiedSignUpOrSignIn",
    "scp": "manage",
    "azp": "c832c38c-ce70-4ebc-83b6-b4548083ac90",
    "ver": "1.0",
    "iat": 1768717683
  }
}
```

### Refresh Token

- **Type:** Encrypted JWT
- **Lifetime:** **90 days** (7,776,000 seconds)
- **Purpose:** Obtain new access tokens without re-authentication

### ID Token

- **Type:** JWT
- **Purpose:** Contains user identity information
- **Lifetime:** **1 hour** (3600 seconds)

---

## Token Refresh

### Refresh Endpoint

```http
POST /tfp/wattsb2cap02.onmicrosoft.com/B2C_1A_Residential_UnifiedSignUpOrSignIn/oauth2/v2.0/token?haschrome=1
Host: login.watts.io
Content-Type: application/x-www-form-urlencoded
x-client-sku: MSAL.Xamarin.iOS
x-client-ver: 4.66.1.0
x-client-os: 26.1
x-client-dm: iPhone

client_id=c832c38c-ce70-4ebc-83b6-b4548083ac90
&scope=https://wattsb2cap02.onmicrosoft.com/wattsapiresi/manage+offline_access+openid+profile
&grant_type=refresh_token
&refresh_token=[REFRESH_TOKEN]
&client_info=1
```

### Refresh Response

```json
{
  "access_token": "[NEW_ACCESS_TOKEN]",
  "id_token": "[NEW_ID_TOKEN]",
  "token_type": "Bearer",
  "not_before": 1768719608,
  "expires_in": 900,
  "expires_on": 1768720508,
  "resource": "978b217d-e864-4f8e-a1d5-587ed65fa544",
  "scope": "https://wattsb2cap02.onmicrosoft.com/wattsapiresi/manage",
  "refresh_token": "[NEW_REFRESH_TOKEN]",
  "refresh_token_expires_in": 7776000,
  "client_info": "eyJ1aWQi..."
}
```

**Important:** The refresh endpoint returns a **new refresh token** as well. You must replace the old refresh token with the new one! This is called "refresh token rotation" - Azure AD B2C issues a new refresh token on each refresh for security.

**Status:** ✅ Confirmed working - captured on 2026-01-18

---

## Authorization Headers

### API Request Headers

All requests to `https://home.watts.com/api/*` require these headers:

```http
Authorization: Bearer [ACCESS_TOKEN]
Api-Version: 2.0
Content-Type: application/json
```

### Example curl Request

```bash
curl -X GET \
  'https://home.watts.com/api/User' \
  -H 'Authorization: Bearer eyJhbGci...' \
  -H 'Api-Version: 2.0'
```

---

## Azure IoT Hub Authentication

If the app uses Azure IoT Hub directly:

### SAS Token Authentication

Azure IoT Hub can use Shared Access Signature (SAS) tokens:

```
SharedAccessSignature sr=[RESOURCE]&sig=[SIGNATURE]&se=[EXPIRY]&skn=[KEYNAME]
```

### Connection String

Some Azure IoT Hub clients use connection strings:

```
HostName=[IOTHUB].azure-devices.net;DeviceId=[DEVICE];SharedAccessKey=[KEY]
```

**Status:** Need to determine if app uses these mechanisms.

---

## Security Considerations

### Token Storage

- Where does the app store tokens? (Keychain / Secure Storage / etc.)
- Are tokens encrypted at rest?

### Token Transmission

- HTTPS is used (TLS 1.2+)
- Certificate pinning? [TO BE DETERMINED]

### Token Rotation

- How often do tokens rotate?
- Is there a maximum refresh token lifetime?

---

## Implementation Notes for Homebridge Plugin

### Recommended Flow

For a Homebridge plugin, you **cannot** use the full OAuth2 flow (requires a web browser). Instead:

**Option 1: Username/Password Authentication (Easiest)**
- Prompt user for Watts Home credentials in Homebridge config
- Implement the full OAuth2 flow programmatically (headless)
- This requires reverse engineering the login form submission (already captured!)
- Store tokens securely in Homebridge storage

**Option 2: Manual Token Entry (Simpler but less user-friendly)**
- User obtains tokens manually (via browser dev tools)
- User pastes tokens into Homebridge config
- Plugin only implements token refresh

**Recommended:** Option 1 with the captured login flow from `02-login-2.txt`:

```javascript
// Step 1: Submit credentials to Azure AD B2C
POST https://login.watts.io/.../SelfAsserted
Content-Type: application/x-www-form-urlencoded

request_type=RESPONSE&signInName=[EMAIL]&password=[PASSWORD]

// Step 2: Follow redirects to get authorization code
// Step 3: Exchange code for tokens
POST https://login.watts.io/.../oauth2/v2.0/token
```

### Token Storage

```javascript
// Store in Homebridge persistent storage
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1768718583  // Unix timestamp
}
```

### Token Refresh Logic

```javascript
class WattsAuth {
  async getValidToken() {
    if (this.isTokenExpired()) {
      await this.refreshToken();
    }
    return this.access_token;
  }

  isTokenExpired() {
    // Refresh 5 minutes before actual expiry
    return Date.now() / 1000 > (this.expires_at - 300);
  }

  async refreshToken() {
    const response = await fetch('https://login.watts.io/.../token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: 'c832c38c-ce70-4ebc-83b6-b4548083ac90',
        scope: 'https://wattsb2cap02.onmicrosoft.com/wattsapiresi/manage offline_access openid profile',
        grant_type: 'refresh_token',
        refresh_token: this.refresh_token,
        client_info: '1'
      })
    });

    const data = await response.json();
    this.access_token = data.access_token;
    this.refresh_token = data.refresh_token;  // Important: update refresh token!
    this.expires_at = data.expires_on;
    await this.saveTokens();
  }
}
```

---

## Open Questions

- [x] ~~Is OAuth 2.0 used?~~ **YES - Azure AD B2C OAuth 2.0 with PKCE**
- [x] ~~Are there different auth scopes/permissions?~~ **Single scope: "manage"**
- [ ] Is MFA (multi-factor authentication) supported?
- [ ] How does the app handle auth errors?
- [x] ~~Can multiple devices share the same token?~~ **YES - tokens are user-based, not device-based**
- [ ] Is there a logout/revoke endpoint?
- [ ] How does the app handle network interruptions during auth?
- [ ] What happens when refresh token expires after 90 days?

---

## Capture Status

- [x] ✅ Fresh install login (captured)
- [x] ✅ Login with valid credentials (captured)
- [ ] ⚠️ Login with invalid credentials (need to capture)
- [x] ✅ Token usage in subsequent requests (captured)
- [ ] ⚠️ Token refresh (need to wait for expiry - **HIGH PRIORITY**)
- [ ] ⚠️ Logout (if applicable)
- [x] ✅ Multiple device login (tokens work across devices)

---

## Security Considerations

### Token Storage

- Tokens contain user identity information
- Store securely in Homebridge's encrypted storage
- Never log tokens in plain text
- Implement token revocation if possible

### PKCE Implementation

- The app uses PKCE for added security
- For a plugin, this may not be necessary if using username/password directly
- If implementing full OAuth, generate proper PKCE challenge/verifier

### Rate Limiting

- Unknown if Azure AD B2C has rate limits
- Implement exponential backoff for failed auth attempts
- Cache tokens aggressively to minimize auth requests

