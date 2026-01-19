/**
 * Watts Home API Library
 * Main entry point for Homebridge plugin and library exports
 */

import type { API } from 'homebridge';

import { TekmarHomebridgePlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

// Library exports for CLI and external use
export { WattsAuth } from './lib/api/auth.js';
export { WattsApiClient } from './lib/api/client.js';
export * from './types/api.js';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, TekmarHomebridgePlatform);
};
