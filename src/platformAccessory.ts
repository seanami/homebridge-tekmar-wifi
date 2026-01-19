import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { TekmarHomebridgePlatform } from './platform.js';
import type { Device } from './types/api.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TekmarThermostatAccessory {
  private service: Service;
  private deviceId: string;
  private cachedDevice: Device | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTimeout = 5000; // 5 seconds
  private pollInterval: NodeJS.Timeout | null = null;

  // State maps
  private readonly stateMap: Record<string, number> = {
    'Off': 0,      // HomeKit OFF
    'Heating': 1,  // HomeKit HEAT
    'Cooling': 2,  // HomeKit COOL
  };

  private readonly modeMap: Record<string, number> = {
    'Off': 0,   // HomeKit OFF
    'Heat': 1,  // HomeKit HEAT
    'Cool': 2,  // HomeKit COOL
    'Auto': 3,  // HomeKit AUTO
  };

  private readonly modeValueMap: Record<number, 'Off' | 'Heat' | 'Cool' | 'Auto'> = {
    0: 'Off',
    1: 'Heat',
    2: 'Cool',
    3: 'Auto',
  };

  constructor(
    private readonly platform: TekmarHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Get device info from context
    const device = accessory.context.device as { deviceId: string; name: string };
    this.deviceId = device.deviceId;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tekmar')
      .setCharacteristic(this.platform.Characteristic.Model, 'WiFi Thermostat')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.deviceId);

    // get the Thermostat service if it exists, otherwise create a new Thermostat service
    this.service = this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    // set the service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, device.name);

    // register handlers for the characteristics
    this.registerHandlers();

    // start polling for device status
    this.startPolling();
  }

  /**
   * Register characteristic handlers
   */
  private registerHandlers() {
    // Current Heating Cooling State (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    // Target Heating Cooling State (read/write)
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    // Current Temperature (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Target Temperature (read/write)
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    // Cooling Threshold Temperature (read/write, for Auto mode)
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    // Heating Threshold Temperature (read/write, for Auto mode)
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    // Temperature Display Units (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this));
  }

  /**
   * Get cached device or fetch from API
   */
  private async getCachedDevice(): Promise<Device> {
    const now = Date.now();
    if (this.cachedDevice && (now - this.cacheTimestamp) < this.cacheTimeout) {
      return this.cachedDevice;
    }

    const apiClient = this.platform.getApiClient();
    const device = await apiClient.getDevice(this.deviceId);
    this.cachedDevice = device;
    this.cacheTimestamp = now;
    return device;
  }

  /**
   * Update cached device after a write operation
   */
  private updateCache(device: Device) {
    this.cachedDevice = device;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Convert temperature from API units to Celsius
   */
  private convertToCelsius(temp: number, units: string): number {
    if (units === 'F') {
      return (temp - 32) * 5 / 9;
    }
    return temp;
  }

  /**
   * Convert temperature from Celsius to API units
   */
  private convertFromCelsius(tempC: number, units: string): number {
    if (units === 'F') {
      return (tempC * 9 / 5) + 32;
    }
    return tempC;
  }

  /**
   * Handle "GET" requests for Current Heating Cooling State
   */
  private async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    try {
      const device = await this.getCachedDevice();
      const state = device.data.State.Op;
      const value = this.stateMap[state] ?? 0;
      this.platform.log.debug(`Get CurrentHeatingCoolingState -> ${value} (${state})`);
      return value;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to get current heating cooling state:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "GET" requests for Target Heating Cooling State
   */
  private async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    try {
      const device = await this.getCachedDevice();
      const mode = device.data.Mode.Val;
      const value = this.modeMap[mode] ?? 0;
      this.platform.log.debug(`Get TargetHeatingCoolingState -> ${value} (${mode})`);
      return value;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to get target heating cooling state:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "SET" requests for Target Heating Cooling State
   */
  private async setTargetHeatingCoolingState(value: CharacteristicValue): Promise<void> {
    try {
      const mode = this.modeValueMap[value as number];
      if (!mode) {
        throw new Error(`Invalid mode value: ${value}`);
      }

      this.platform.log.info(`Set TargetHeatingCoolingState -> ${value} (${mode})`);

      const apiClient = this.platform.getApiClient();
      const device = await apiClient.setDeviceMode(this.deviceId, mode);
      this.updateCache(device);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to set target heating cooling state:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "GET" requests for Current Temperature
   */
  private async getCurrentTemperature(): Promise<CharacteristicValue> {
    try {
      const device = await this.getCachedDevice();
      const temp = device.data.Sensors.Room.Val;
      const units = device.data.TempUnits.Val;
      const tempC = this.convertToCelsius(temp, units);
      this.platform.log.debug(`Get CurrentTemperature -> ${tempC}°C (${temp}°${units})`);
      return tempC;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to get current temperature:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "GET" requests for Target Temperature
   */
  private async getTargetTemperature(): Promise<CharacteristicValue> {
    try {
      const device = await this.getCachedDevice();
      const mode = device.data.Mode.Val;
      const units = device.data.TempUnits.Val;

      let temp: number;
      if (mode === 'Heat') {
        temp = device.data.Target.Heat;
      } else if (mode === 'Cool') {
        temp = device.data.Target.Cool;
      } else {
        // Auto or Off - use heat threshold as primary target
        temp = device.data.Target.Heat;
      }

      const tempC = this.convertToCelsius(temp, units);
      this.platform.log.debug(`Get TargetTemperature -> ${tempC}°C (${temp}°${units}, mode: ${mode})`);
      return tempC;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to get target temperature:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "SET" requests for Target Temperature
   */
  private async setTargetTemperature(value: CharacteristicValue): Promise<void> {
    try {
      const device = await this.getCachedDevice();
      const mode = device.data.Mode.Val;
      const units = device.data.TempUnits.Val;
      const temp = this.convertFromCelsius(value as number, units);

      this.platform.log.info(`Set TargetTemperature -> ${value}°C (${temp}°${units}, mode: ${mode})`);

      const apiClient = this.platform.getApiClient();
      let updatedDevice: Device;

      if (mode === 'Heat') {
        updatedDevice = await apiClient.setDeviceHeatTemp(this.deviceId, temp);
      } else if (mode === 'Cool') {
        updatedDevice = await apiClient.setDeviceCoolTemp(this.deviceId, temp);
      } else if (mode === 'Auto') {
        // In Auto mode, setting target temp should update heat threshold
        // Need to preserve cool threshold
        const coolTemp = device.data.Target.Cool;
        updatedDevice = await apiClient.setDeviceAutoTemps(this.deviceId, temp, coolTemp);
      } else {
        throw new Error(`Cannot set temperature in ${mode} mode`);
      }

      this.updateCache(updatedDevice);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to set target temperature:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "GET" requests for Cooling Threshold Temperature
   */
  private async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
    try {
      const device = await this.getCachedDevice();
      const temp = device.data.Target.Cool;
      const units = device.data.TempUnits.Val;
      const tempC = this.convertToCelsius(temp, units);
      this.platform.log.debug(`Get CoolingThresholdTemperature -> ${tempC}°C (${temp}°${units})`);
      return tempC;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to get cooling threshold temperature:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "SET" requests for Cooling Threshold Temperature
   */
  private async setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    try {
      const device = await this.getCachedDevice();
      const units = device.data.TempUnits.Val;
      const temp = this.convertFromCelsius(value as number, units);

      this.platform.log.info(`Set CoolingThresholdTemperature -> ${value}°C (${temp}°${units})`);

      const apiClient = this.platform.getApiClient();
      // In Auto mode, always send both Heat and Cool values
      const heatTemp = device.data.Target.Heat;
      const updatedDevice = await apiClient.setDeviceAutoTemps(this.deviceId, heatTemp, temp);
      this.updateCache(updatedDevice);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to set cooling threshold temperature:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "GET" requests for Heating Threshold Temperature
   */
  private async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
    try {
      const device = await this.getCachedDevice();
      const temp = device.data.Target.Heat;
      const units = device.data.TempUnits.Val;
      const tempC = this.convertToCelsius(temp, units);
      this.platform.log.debug(`Get HeatingThresholdTemperature -> ${tempC}°C (${temp}°${units})`);
      return tempC;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to get heating threshold temperature:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "SET" requests for Heating Threshold Temperature
   */
  private async setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    try {
      const device = await this.getCachedDevice();
      const units = device.data.TempUnits.Val;
      const temp = this.convertFromCelsius(value as number, units);

      this.platform.log.info(`Set HeatingThresholdTemperature -> ${value}°C (${temp}°${units})`);

      const apiClient = this.platform.getApiClient();
      // In Auto mode, always send both Heat and Cool values
      const coolTemp = device.data.Target.Cool;
      const updatedDevice = await apiClient.setDeviceAutoTemps(this.deviceId, temp, coolTemp);
      this.updateCache(updatedDevice);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to set heating threshold temperature:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle "GET" requests for Temperature Display Units
   */
  private async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    try {
      const device = await this.getCachedDevice();
      const units = device.data.TempUnits.Val;
      // HomeKit: 0 = Celsius, 1 = Fahrenheit
      const value = units === 'C' ? 0 : 1;
      this.platform.log.debug(`Get TemperatureDisplayUnits -> ${value} (${units})`);
      return value;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error('Failed to get temperature display units:', err.message || 'Unknown error');
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Start polling for device status updates
   */
  private startPolling() {
    const interval = this.platform.getPollingInterval() * 1000; // Convert to milliseconds

    this.pollInterval = setInterval(async () => {
      try {
        await this.updateDeviceStatus();
      } catch (error: unknown) {
        const err = error as { message?: string };
        this.platform.log.error(`Failed to poll device ${this.deviceId}:`, err.message || 'Unknown error');
      }
    }, interval);

    this.platform.log.debug(`Started polling for device ${this.deviceId} (interval: ${interval}ms)`);
  }

  /**
   * Update device status and refresh characteristics
   */
  private async updateDeviceStatus() {
    try {
      const device = await this.getCachedDevice();
      this.updateCache(device);

      // Update all characteristics
      const units = device.data.TempUnits.Val;
      const state = this.stateMap[device.data.State.Op] ?? 0;
      const mode = this.modeMap[device.data.Mode.Val] ?? 0;
      const currentTemp = this.convertToCelsius(device.data.Sensors.Room.Val, units);

      let targetTemp: number;
      if (device.data.Mode.Val === 'Heat') {
        targetTemp = this.convertToCelsius(device.data.Target.Heat, units);
      } else if (device.data.Mode.Val === 'Cool') {
        targetTemp = this.convertToCelsius(device.data.Target.Cool, units);
      } else {
        targetTemp = this.convertToCelsius(device.data.Target.Heat, units);
      }

      const heatThreshold = this.convertToCelsius(device.data.Target.Heat, units);
      const coolThreshold = this.convertToCelsius(device.data.Target.Cool, units);
      const displayUnits = units === 'C' ? 0 : 1;

      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentHeatingCoolingState,
        state,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
        mode,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        currentTemp,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        targetTemp,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature,
        heatThreshold,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature,
        coolThreshold,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.TemperatureDisplayUnits,
        displayUnits,
      );

      this.platform.log.debug(`Updated characteristics for device ${this.deviceId}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error(`Failed to update device status for ${this.deviceId}:`, err.message || 'Unknown error');
    }
  }

  /**
   * Clean up polling interval when accessory is removed
   */
  public destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.platform.log.debug(`Stopped polling for device ${this.deviceId}`);
    }
  }
}
