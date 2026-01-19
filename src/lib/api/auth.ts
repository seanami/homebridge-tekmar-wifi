/**
 * Authentication client for Watts Home API
 * Handles OAuth 2.0 flow with Azure AD B2C
 */

import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TokenResponse, StoredTokens } from '../../types/api.js';
import { logger } from '../logger.js';

const CLIENT_ID = 'c832c38c-ce70-4ebc-83b6-b4548083ac90';
const REDIRECT_URI = 'msalc832c38c-ce70-4ebc-83b6-b4548083ac90://auth';
const SCOPE = 'https://wattsb2cap02.onmicrosoft.com/wattsapiresi/manage offline_access openid profile';
const POLICY = 'B2C_1A_Residential_UnifiedSignUpOrSignIn';
const LOGIN_BASE = 'https://login.watts.io';

interface PKCEPair {
  challenge: string;
  verifier: string;
}

export class WattsAuth {
  private tokens: StoredTokens | null = null;
  private codeVerifier: string | null = null;
  private tokensFile: string;

  constructor(storagePath?: string) {
    if (storagePath) {
      // Ensure directory exists
      const tokensDir = path.join(storagePath, 'homebridge-tekmar-wifi');
      this.tokensFile = path.join(tokensDir, 'tokens.json');
      // Create directory with proper permissions (will be done on first save)
    } else {
      // Default: use process.cwd() for CLI compatibility
      this.tokensFile = path.join(process.cwd(), 'tokens.json');
    }
  }

  /**
   * Generate PKCE challenge and verifier
   */
  private generatePKCE(): PKCEPair {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { challenge, verifier };
  }

  /**
   * Generate random state for OAuth flow
   */
  private generateState(): string {
    return crypto.randomUUID();
  }

  /**
   * Extract JavaScript variable value from HTML
   */
  private extractJavaScriptVar(html: string, varName: string): string | null {
    // Match var SETTINGS = {..."csrf":"...","transId":"..."};
    const regex = new RegExp(`"${varName}"\\s*:\\s*"([^"]+)"`, 'i');
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Parse cookies from Set-Cookie header(s)
   * Set-Cookie headers come as an array (one per cookie), not comma-separated
   */
  private parseCookies(setCookieHeader: string | string[] | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!setCookieHeader) {
      return cookies;
    }

    // Handle array of Set-Cookie headers (axios returns array for multiple Set-Cookie headers)
    const cookieHeaders = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];

    for (const cookieHeader of cookieHeaders) {
      // Each Set-Cookie header: "name=value; Path=/; Domain=..."
      // We only need the name=value part
      const [nameValue] = cookieHeader.split(';');
      // Split on first '=' only (cookie name can have special chars, value can have =)
      const eqIndex = nameValue.indexOf('=');
      if (eqIndex > 0) {
        const name = nameValue.substring(0, eqIndex).trim();
        const value = nameValue.substring(eqIndex + 1).trim();
        if (name && value) {
          cookies[name] = value;
        }
      }
    }
    return cookies;
  }

  /**
   * Format cookies object into Cookie header string
   */
  private formatCookies(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  /**
   * Load tokens from file
   */
  async loadTokens(): Promise<StoredTokens | null> {
    try {
      const data = await fs.readFile(this.tokensFile, 'utf-8');
      this.tokens = JSON.parse(data);
      return this.tokens;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Save tokens to file
   */
  async saveTokens(tokens: StoredTokens): Promise<void> {
    this.tokens = tokens;
    // Ensure directory exists (for Homebridge storage path)
    const tokensDir = path.dirname(this.tokensFile);
    await fs.mkdir(tokensDir, { recursive: true, mode: 0o700 });
    await fs.writeFile(this.tokensFile, JSON.stringify(tokens, null, 2), {
      mode: 0o600, // Restrictive permissions
    });
  }

  /**
   * Check if token is expired or expiring soon
   */
  isTokenExpired(tokens: StoredTokens, bufferSeconds = 300): boolean {
    const now = Math.floor(Date.now() / 1000);
    return tokens.expires_at <= (now + bufferSeconds);
  }

  /**
   * Get valid access token, refreshing if needed
   */
  async getValidToken(): Promise<string> {
    let tokens = this.tokens || (await this.loadTokens());
    if (!tokens) {
      throw new Error('No tokens found. Please run "watts-cli login" first.');
    }

    if (this.isTokenExpired(tokens)) {
      tokens = await this.refreshToken();
    }

    return tokens.access_token;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<StoredTokens> {
    await logger.info('Starting login flow', { email });

    try {
      // Step 1: Get login page and extract CSRF token/transaction ID
      await logger.info('Step 1: Getting login page');
      const { csrfToken, transId, cookies } = await this.getLoginPage();
      await logger.debug('Extracted CSRF token and transaction ID', { hasCsrf: !!csrfToken, hasTransId: !!transId });

      // Step 2: Submit credentials
      await logger.info('Step 2: Submitting credentials');
      const updatedCookies = await this.submitCredentials(email, password, csrfToken, transId, cookies);

      // Step 3: Follow redirect and extract authorization code
      await logger.info('Step 3: Getting authorization code');
      const authCode = await this.getAuthorizationCode(csrfToken, transId, updatedCookies);
      await logger.debug('Extracted authorization code', { hasAuthCode: !!authCode });

      // Step 4: Exchange authorization code for tokens
      await logger.info('Step 4: Exchanging authorization code for tokens');
      const tokenResponse = await this.exchangeCodeForTokens(authCode);

      // Save tokens
      const tokens: StoredTokens = {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: tokenResponse.expires_on,
        refresh_token_expires_at: Math.floor(Date.now() / 1000) + tokenResponse.refresh_token_expires_in,
      };

      await this.saveTokens(tokens);
      await logger.info('Login successful, tokens saved');
      return tokens;
    } catch (error: unknown) {
      await logger.error('Login failed', error);
      throw error;
    }
  }

  /**
   * Step 1: Get login page and extract CSRF token/transaction ID
   */
  private async getLoginPage(): Promise<{ csrfToken: string; transId: string; cookies: Record<string, string> }> {
    const { challenge, verifier } = this.generatePKCE();
    this.codeVerifier = verifier;

    const url = new URL(`${LOGIN_BASE}/tfp/wattsb2cap02.onmicrosoft.com/${POLICY}/oauth2/v2.0/authorize`);
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'login');
    url.searchParams.set('state', this.generateState());

    await logger.logRequest('GET', url.toString());

    try {
      const response = await axios.get(url.toString(), {
        maxRedirects: 0,
        validateStatus: (status) => status === 200,
      });

      await logger.logResponse(response.status, response.statusText, response.headers);

      const html = response.data;
      const csrfToken = this.extractJavaScriptVar(html, 'csrf');
      const transId = this.extractJavaScriptVar(html, 'transId');

      if (!csrfToken || !transId) {
        await logger.error('Failed to extract CSRF token or transaction ID', {
          htmlLength: html.length,
          htmlPreview: html.substring(0, 500),
        });
        throw new Error('Failed to extract CSRF token or transaction ID from login page');
      }

      // set-cookie header can be string or string[] - parse directly
      const setCookieHeader = response.headers['set-cookie'];
      const cookies = this.parseCookies(setCookieHeader);
      
      await logger.info('Parsed cookies from login page', {
        cookieCount: Object.keys(cookies).length,
        cookieNames: Object.keys(cookies),
      });

      return { csrfToken, transId, cookies };
    } catch (error: unknown) {
      await logger.error('Failed to get login page', error);
      throw error;
    }
  }

  /**
   * Step 2: Submit credentials
   * Returns updated cookies from the response
   */
  private async submitCredentials(
    email: string,
    password: string,
    csrfToken: string,
    transId: string,
    cookies: Record<string, string>,
  ): Promise<Record<string, string>> {
    const formData = new URLSearchParams({
      request_type: 'RESPONSE',
      signInName: email,
      password: password,
    });

    const url = `${LOGIN_BASE}/wattsb2cap02.onmicrosoft.com/${POLICY}/SelfAsserted?tx=${encodeURIComponent(transId)}&p=${POLICY}`;

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-csrf-token': csrfToken,
      'Cookie': this.formatCookies(cookies),
    };

    // Always log request details for debugging auth issues
    await logger.info('Submitting credentials', {
      url,
      headers: logger.sanitizeHeaders(headers),
      body: { request_type: 'RESPONSE', signInName: email, password: '[REDACTED]' },
      transId,
      csrfTokenPresent: !!csrfToken,
      cookieCount: Object.keys(cookies).length,
      cookieNames: Object.keys(cookies),
    });

    try {
      const response = await axios.post(url, formData.toString(), {
        headers,
        maxRedirects: 0,
        validateStatus: (status) => status === 200 || status === 302,
      });

      await logger.info('Credential submission response', {
        status: response.status,
        statusText: response.statusText,
        headers: logger.sanitizeHeaders(response.headers),
        data: response.data,
      });

      const result = response.data;
      if (result.status !== '200') {
        await logger.error('Credential submission failed', {
          status: result.status,
          message: result.message,
          fullResponse: result,
        });
        throw new Error(`Login failed: ${result.message || 'Unknown error'}`);
      }

      // Update cookies with new ones from response
      const setCookieHeader = response.headers['set-cookie'];
      const updatedCookies = { ...cookies, ...this.parseCookies(setCookieHeader) };
      
      await logger.info('Updated cookies after credential submission', {
        cookieCount: Object.keys(updatedCookies).length,
        cookieNames: Object.keys(updatedCookies),
      });

      return updatedCookies;
    } catch (error: unknown) {
      await logger.error('Failed to submit credentials', error);
      throw error;
    }
  }

  /**
   * Step 3: Follow redirect to /confirmed and extract authorization code
   */
  private async getAuthorizationCode(
    csrfToken: string,
    transId: string,
    cookies: Record<string, string>,
  ): Promise<string> {
    const baseUrl = `${LOGIN_BASE}/tfp/wattsb2cap02.onmicrosoft.com/${POLICY}`;
    const url = `${baseUrl}/api/CombinedSigninAndSignup/confirmed?rememberMe=false&csrf_token=${csrfToken}&tx=${encodeURIComponent(transId)}&p=${POLICY}`;

    const headers = {
      'Cookie': this.formatCookies(cookies),
    };

    await logger.logRequest('GET', url, headers);

    try {
      const response = await axios.get(url, {
        headers,
        maxRedirects: 0,
        validateStatus: (status) => status === 302,
      });

      await logger.logResponse(response.status, response.statusText, response.headers);

      const redirectUrl = response.headers.location;
      if (!redirectUrl) {
        await logger.error('No redirect URL after login confirmation', { headers: response.headers });
        throw new Error('No redirect URL after login confirmation');
      }

      await logger.debug('Redirect URL received', { redirectUrl });

      const codeMatch = redirectUrl.match(/code=([^&]+)/);
      if (!codeMatch) {
        await logger.error('No authorization code in redirect URL', { redirectUrl });
        throw new Error('No authorization code in redirect URL');
      }

      return decodeURIComponent(codeMatch[1]);
    } catch (error: unknown) {
      await logger.error('Failed to get authorization code', error);
      throw error;
    }
  }

  /**
   * Step 4: Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(authCode: string): Promise<TokenResponse> {
    if (!this.codeVerifier) {
      throw new Error('PKCE verifier not found');
    }

    const formData = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPE,
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      code_verifier: this.codeVerifier,
      client_info: '1',
    });

    const url = `${LOGIN_BASE}/tfp/wattsb2cap02.onmicrosoft.com/${POLICY}/oauth2/v2.0/token`;

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    await logger.logRequest('POST', url, headers, {
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code: '[REDACTED]',
      code_verifier: '[REDACTED]',
    });

    try {
      const response = await axios.post<TokenResponse>(url, formData.toString(), {
        headers,
      });

      await logger.logResponse(response.status, response.statusText, response.headers, {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        expires_in: response.data.expires_in,
      });

      return response.data;
    } catch (error: unknown) {
      await logger.error('Failed to exchange code for tokens', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<StoredTokens> {
    const tokens = this.tokens || await this.loadTokens();
    if (!tokens) {
      throw new Error('No tokens found. Please run "watts-cli login" first.');
    }

    const formData = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPE,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_info: '1',
    });

    const url = `${LOGIN_BASE}/tfp/wattsb2cap02.onmicrosoft.com/${POLICY}/oauth2/v2.0/token`;

    const response = await axios.post<TokenResponse>(url, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const tokenResponse = response.data;

    const newTokens: StoredTokens = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token || tokens.refresh_token, // Some APIs don't return new refresh token
      expires_at: tokenResponse.expires_on,
      refresh_token_expires_at: tokens.refresh_token_expires_at, // Keep existing expiry
    };

    await this.saveTokens(newTokens);
    return newTokens;
  }
}
