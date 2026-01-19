import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { TekmarThermostatAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { WattsAuth } from './lib/api/auth.js';
import { WattsApiClient } from './lib/api/client.js';
import type { DeviceSummary } from './types/api.js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TekmarHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  private auth: WattsAuth;
  private apiClient: WattsApiClient;
  private pollingInterval: number;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    // Get storage path from Homebridge
    const storagePath = api.user.storagePath();
    const pluginStoragePath = `${storagePath}/homebridge-tekmar-wifi`;

    // Initialize auth with configurable storage path
    this.auth = new WattsAuth(pluginStoragePath);

    // Initialize API client
    this.apiClient = new WattsApiClient(this.auth);

    // Get polling interval from config (default 120 seconds)
    this.pollingInterval = (config.pollingInterval as number) || 120;

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);

    // Create the accessory handler for the restored accessory
    new TekmarThermostatAccessory(this, accessory);
  }

  /**
   * This method discovers all Tekmar thermostats and registers them as accessories.
   */
  async discoverDevices() {
    try {
      // Authenticate using credentials from config
      const email = this.config.email as string;
      const password = this.config.password as string;

      if (!email || !password) {
        this.log.error('Email and password are required in config');
        return;
      }

      this.log.info('Authenticating with Watts Home API...');
      try {
        await this.auth.login(email, password);
        this.log.info('Authentication successful');
      } catch (error: unknown) {
        // If login fails, try loading existing tokens
        const err = error as { message?: string };
        const tokens = await this.auth.loadTokens();
        if (!tokens) {
          this.log.error('Authentication failed and no existing tokens found:', err.message || 'Unknown error');
          return;
        }
        this.log.info('Using existing tokens');
      }

      // Get all locations
      this.log.info('Discovering locations...');
      const locations = await this.apiClient.getLocations();
      this.log.info(`Found ${locations.length} location(s)`);

      // Get all devices across all locations
      const allDevices: Array<{ device: DeviceSummary; locationId: string }> = [];

      for (const location of locations) {
        try {
          const devices = await this.apiClient.getLocationDevices(location.locationId);
          this.log.info(`Found ${devices.length} device(s) in location "${location.name}"`);
          for (const device of devices) {
            allDevices.push({ device, locationId: location.locationId });
          }
        } catch (error: unknown) {
          const err = error as { message?: string };
          this.log.warn(`Failed to get devices for location ${location.name}:`, err.message || 'Unknown error');
        }
      }

      this.log.info(`Total devices discovered: ${allDevices.length}`);

      // Register each device as an accessory
      for (const { device, locationId } of allDevices) {
        // Only register thermostat devices
        if (device.deviceType !== 'Thermostat') {
          this.log.debug(`Skipping non-thermostat device: ${device.name} (${device.deviceType})`);
          continue;
        }

        // generate a unique id for the accessory
        const uuid = this.api.hap.uuid.generate(device.deviceId);

        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          // the accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

          // create the accessory handler for the restored accessory
          new TekmarThermostatAccessory(this, existingAccessory);

          // push into discoveredCacheUUIDs
          this.discoveredCacheUUIDs.push(uuid);
        } else {
          // the accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', device.name);

          // create a new accessory
          const accessory = new this.api.platformAccessory(device.name, uuid);

          // store a copy of the device object in the `accessory.context`
          accessory.context.device = device;
          accessory.context.locationId = locationId;

          // create the accessory handler for the newly create accessory
          new TekmarThermostatAccessory(this, accessory);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

          // push into discoveredCacheUUIDs
          this.discoveredCacheUUIDs.push(uuid);
        }
      }

      // Remove accessories that are no longer present
      for (const [uuid, accessory] of this.accessories) {
        if (!this.discoveredCacheUUIDs.includes(uuid)) {
          this.log.info('Removing existing accessory from cache:', accessory.displayName);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.log.error('Failed to discover devices:', err.message || 'Unknown error');
      if (this.config.debug) {
        this.log.error('Error details:', error);
      }
    }
  }

  /**
   * Get the API client instance
   */
  getApiClient(): WattsApiClient {
    return this.apiClient;
  }

  /**
   * Get the polling interval in seconds
   */
  getPollingInterval(): number {
    return this.pollingInterval;
  }
}
