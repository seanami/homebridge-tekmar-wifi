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

    // Perform initial update to populate characteristics immediately
    // This ensures HomeKit has values right away (no slow getter calls needed)
    this.updateDeviceStatus().catch((error: unknown) => {
      const err = error as { message?: string };
      this.platform.log.error(`Failed initial device status update for ${this.deviceId}:`, err.message || 'Unknown error');
    });

    // start polling for device status
    this.startPolling();
  }

  /**
   * Register characteristic handlers
   */
  private registerHandlers() {
    // Set proper min/max values on characteristics (like tado plugin does)
    // This allows HomeKit to validate values properly
    
    // Current Temperature: Allow wide range for sensor readings
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).setProps({
      minValue: -50,
      maxValue: 100,
    });

    // Target Temperature: Typical thermostat range
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature).setProps({
      minValue: 10,
      maxValue: 38,
      minStep: 0.1,
    });

    // Cooling Threshold: HomeKit spec range
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).setProps({
      minValue: 10,
      maxValue: 35,
      minStep: 0.1,
    });

    // Heating Threshold: HomeKit spec range
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).setProps({
      minValue: 0,
      maxValue: 25,
      minStep: 0.1,
    });

    // Register handlers following tado plugin pattern:
    // - DON'T register onGet handlers for characteristics updated via polling
    // - HomeKit will read the cached .value property directly (fast, no async calls)
    // - Only register onSet handlers for writable characteristics
    // - Use updateValue() in polling to keep characteristics up-to-date

    // Target Heating Cooling State (read/write) - only onSet, no onGet
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    // Target Temperature (read/write) - only onSet, no onGet
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this));

    // Cooling Threshold Temperature (read/write) - only onSet, no onGet
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    // Heating Threshold Temperature (read/write) - only onSet, no onGet
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    // Temperature Display Units - no handlers needed (read-only, updated via polling)
    // Current Temperature - no handlers needed (read-only, updated via polling)
    // Current Heating Cooling State - no handlers needed (read-only, updated via polling)
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
   * Safely get device data, returning null if not available
   */
  private async getDeviceData(): Promise<Device['data'] | null> {
    try {
      const device = await this.getCachedDevice();
      return device.data || null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.platform.log.error(`Failed to get device data for ${this.deviceId}:`, err.message || 'Unknown error');
      return null;
    }
  }

  /**
   * Clamp temperature to valid HomeKit range
   * Cooling Threshold: 10-35°C
   * Heating Threshold: 0-25°C
   * General: -50-100°C (reasonable range for thermostats)
   */
  private clampTemperature(temp: number, type: 'cooling' | 'heating' | 'general'): number {
    if (type === 'cooling') {
      return Math.max(10, Math.min(35, temp));
    } else if (type === 'heating') {
      return Math.max(0, Math.min(25, temp));
    }
    // General temperature: reasonable range for thermostats
    return Math.max(-50, Math.min(100, temp));
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
      const data = await this.getDeviceData();
      if (!data || !data.State || !data.State.Op) {
        this.platform.log.warn('Device data not available for current state');
        // Throw error instead of returning default - let HomeKit show "Not Responding"
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
      }
      const state = data.State.Op;
      const value = this.stateMap[state] ?? 0;
      this.platform.log.debug(`Get CurrentHeatingCoolingState -> ${value} (${state})`);
      return value;
    } catch (error: unknown) {
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
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
      const data = await this.getDeviceData();
      if (!data || !data.Mode || !data.Mode.Val) {
        this.platform.log.warn('Device data not available for target state');
        // Throw error instead of returning default - let HomeKit show "Not Responding"
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
      }
      const mode = data.Mode.Val;
      const value = this.modeMap[mode] ?? 0;
      this.platform.log.debug(`Get TargetHeatingCoolingState -> ${value} (${mode})`);
      return value;
    } catch (error: unknown) {
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
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
      const data = await this.getDeviceData();
      if (!data || !data.Sensors || !data.Sensors.Room || typeof data.Sensors.Room.Val !== 'number') {
        this.platform.log.warn('Device data not available for current temperature');
        // Throw error instead of returning default - let HomeKit show "Not Responding"
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
      }
      const temp = data.Sensors.Room.Val;
      const units = data.TempUnits?.Val || 'C';
      const tempC = this.convertToCelsius(temp, units);
      // Don't clamp in getter - HomeKit will validate via props
      // Clamping happens in updateDeviceStatus() when polling
      this.platform.log.debug(`Get CurrentTemperature -> ${tempC}°C (${temp}°${units})`);
      return tempC;
    } catch (error: unknown) {
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
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
      const data = await this.getDeviceData();
      if (!data || !data.Mode || !data.Target) {
        this.platform.log.warn('Device data not available for target temperature');
        // Throw error instead of returning default - let HomeKit show "Not Responding"
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
      }
      const mode = data.Mode.Val;
      const units = data.TempUnits?.Val || 'C';

      let temp: number;
      if (mode === 'Heat') {
        temp = data.Target.Heat;
      } else if (mode === 'Cool') {
        temp = data.Target.Cool;
      } else {
        // Auto or Off - use heat threshold as primary target
        temp = data.Target.Heat;
      }

      const tempC = this.convertToCelsius(temp, units);
      // Don't clamp in getter - HomeKit will validate via props
      // Clamping happens in updateDeviceStatus() when polling
      this.platform.log.debug(`Get TargetTemperature -> ${tempC}°C (${temp}°${units}, mode: ${mode})`);
      return tempC;
    } catch (error: unknown) {
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
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
      const data = await this.getDeviceData();
      if (!data || !data.Mode || !data.Target) {
        throw new Error('Device data not available');
      }
      const mode = data.Mode.Val;
      const units = data.TempUnits?.Val || 'C';
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
        const coolTemp = data.Target.Cool;
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
      const data = await this.getDeviceData();
      if (!data || !data.Target || typeof data.Target.Cool !== 'number') {
        this.platform.log.warn('Device data not available for cooling threshold');
        // Throw error instead of returning default - let HomeKit show "Not Responding"
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
      }
      const temp = data.Target.Cool;
      const units = data.TempUnits?.Val || 'C';
      const tempC = this.convertToCelsius(temp, units);
      // Don't clamp in getter - HomeKit will validate via props
      // Clamping happens in updateDeviceStatus() when polling
      this.platform.log.debug(`Get CoolingThresholdTemperature -> ${tempC}°C (${temp}°${units})`);
      return tempC;
    } catch (error: unknown) {
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
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
      const data = await this.getDeviceData();
      if (!data || !data.Target) {
        throw new Error('Device data not available');
      }
      // Clamp the value before setting
      const clampedValue = this.clampTemperature(value as number, 'cooling');
      if (clampedValue !== value) {
        this.platform.log.warn(`Cooling threshold ${value}°C clamped to ${clampedValue}°C (valid range: 10-35°C)`);
      }
      const units = data.TempUnits?.Val || 'C';
      const temp = this.convertFromCelsius(clampedValue, units);

      this.platform.log.info(`Set CoolingThresholdTemperature -> ${clampedValue}°C (${temp}°${units})`);

      const apiClient = this.platform.getApiClient();
      // In Auto mode, always send both Heat and Cool values
      const heatTemp = data.Target.Heat;
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
      const data = await this.getDeviceData();
      if (!data || !data.Target || typeof data.Target.Heat !== 'number') {
        this.platform.log.warn('Device data not available for heating threshold');
        // Throw error instead of returning default - let HomeKit show "Not Responding"
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
      }
      const temp = data.Target.Heat;
      const units = data.TempUnits?.Val || 'C';
      const tempC = this.convertToCelsius(temp, units);
      // Don't clamp in getter - HomeKit will validate via props
      // Clamping happens in updateDeviceStatus() when polling
      this.platform.log.debug(`Get HeatingThresholdTemperature -> ${tempC}°C (${temp}°${units})`);
      return tempC;
    } catch (error: unknown) {
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
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
      const data = await this.getDeviceData();
      if (!data || !data.Target) {
        throw new Error('Device data not available');
      }
      // Clamp the value before setting
      const clampedValue = this.clampTemperature(value as number, 'heating');
      if (clampedValue !== value) {
        this.platform.log.warn(`Heating threshold ${value}°C clamped to ${clampedValue}°C (valid range: 0-25°C)`);
      }
      const units = data.TempUnits?.Val || 'C';
      const temp = this.convertFromCelsius(clampedValue, units);

      this.platform.log.info(`Set HeatingThresholdTemperature -> ${clampedValue}°C (${temp}°${units})`);

      const apiClient = this.platform.getApiClient();
      // In Auto mode, always send both Heat and Cool values
      const coolTemp = data.Target.Cool;
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
      const data = await this.getDeviceData();
      if (!data || !data.TempUnits || !data.TempUnits.Val) {
        this.platform.log.warn('Device data not available for temperature units');
        // Throw error instead of returning default - let HomeKit show "Not Responding"
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
      }
      const units = data.TempUnits.Val;
      // HomeKit: 0 = Celsius, 1 = Fahrenheit
      const value = units === 'C' ? 0 : 1;
      this.platform.log.debug(`Get TemperatureDisplayUnits -> ${value} (${units})`);
      return value;
    } catch (error: unknown) {
      if (error instanceof this.platform.api.hap.HapStatusError) {
        throw error;
      }
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
      const data = await this.getDeviceData();
      
      if (!data) {
        this.platform.log.warn(`Device data not available for ${this.deviceId}, skipping update`);
        return;
      }

      // Update cache timestamp
      const device = await this.getCachedDevice();
      this.updateCache(device);

      // Update all characteristics with null checks (like tado plugin does)
      // Only update if values are valid (!isNaN check pattern from tado)
      const units = data.TempUnits?.Val || 'C';
      
      let state: number | undefined;
      if (data.State?.Op) {
        state = this.stateMap[data.State.Op] ?? 0;
      }

      let mode: number | undefined;
      if (data.Mode?.Val) {
        mode = this.modeMap[data.Mode.Val] ?? 0;
      }

      let currentTemp: number | undefined;
      if (data.Sensors?.Room?.Val !== undefined && typeof data.Sensors.Room.Val === 'number') {
        currentTemp = this.convertToCelsius(data.Sensors.Room.Val, units);
      }

      let targetTemp: number | undefined;
      if (data.Mode?.Val === 'Heat' && data.Target?.Heat !== undefined) {
        targetTemp = this.convertToCelsius(data.Target.Heat, units);
      } else if (data.Mode?.Val === 'Cool' && data.Target?.Cool !== undefined) {
        targetTemp = this.convertToCelsius(data.Target.Cool, units);
      } else if (data.Target?.Heat !== undefined) {
        targetTemp = this.convertToCelsius(data.Target.Heat, units);
      }

      // Clamp values when updating (like tado plugin does)
      // Check if values are out of range and clamp them
      let heatThreshold = data.Target?.Heat !== undefined
        ? this.convertToCelsius(data.Target.Heat, units)
        : 20;
      let coolThreshold = data.Target?.Cool !== undefined
        ? this.convertToCelsius(data.Target.Cool, units)
        : 25;

      // Clamp to valid ranges (like tado does in lines 223-227, 236-240)
      const heatMin = this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).props.minValue || 0;
      const heatMax = this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).props.maxValue || 25;
      const coolMin = this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).props.minValue || 10;
      const coolMax = this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).props.maxValue || 35;

      if (heatThreshold < heatMin || heatThreshold > heatMax) {
        const oldValue = heatThreshold;
        heatThreshold = Math.max(heatMin, Math.min(heatMax, heatThreshold));
        if (oldValue !== heatThreshold) {
          this.platform.log.warn(`Heating threshold ${oldValue}°C clamped to ${heatThreshold}°C (valid range: ${heatMin}-${heatMax}°C)`);
        }
      }

      if (coolThreshold < coolMin || coolThreshold > coolMax) {
        const oldValue = coolThreshold;
        coolThreshold = Math.max(coolMin, Math.min(coolMax, coolThreshold));
        if (oldValue !== coolThreshold) {
          this.platform.log.warn(`Cooling threshold ${oldValue}°C clamped to ${coolThreshold}°C (valid range: ${coolMin}-${coolMax}°C)`);
        }
      }
      const displayUnits = units === 'C' ? 0 : 1;

      // Only update characteristics if values are valid (!isNaN pattern from tado)
      if (state !== undefined && !isNaN(state)) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState,
          state,
        );
      }

      if (mode !== undefined && !isNaN(mode)) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState,
          mode,
        );
      }

      if (currentTemp !== undefined && !isNaN(currentTemp)) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          currentTemp,
        );
      }

      if (targetTemp !== undefined && !isNaN(targetTemp)) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetTemperature,
          targetTemp,
        );
      }

      if (!isNaN(heatThreshold)) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.HeatingThresholdTemperature,
          heatThreshold,
        );
      }

      if (!isNaN(coolThreshold)) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.CoolingThresholdTemperature,
          coolThreshold,
        );
      }

      // Always update display units (it's a simple value)
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
