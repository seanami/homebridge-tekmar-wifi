/**
 * API client for Watts Home API
 * Handles all API interactions with the Watts Home service
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { WattsAuth } from './auth.js';
import {
  ApiResponse,
  User,
  Location,
  Device,
  DeviceSummary,
  DeviceSettings,
} from '../../types/api.js';

const API_BASE = 'https://home.watts.com/api';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_STATUSES = [408, 429, 500, 502, 503, 504];

export class WattsApiClient {
  private http: AxiosInstance;
  private auth: WattsAuth;

  constructor(auth: WattsAuth) {
    this.auth = auth;
    this.http = axios.create({
      baseURL: API_BASE,
      headers: {
        'Api-Version': '2.0',
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    // Intercept requests to add authorization header
    this.http.interceptors.request.use(async (config) => {
      const token = await this.auth.getValidToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.http.request<ApiResponse<T>>({
          timeout: REQUEST_TIMEOUT_MS,
          ...config,
        });
        const apiResponse = response.data;

        if (apiResponse.errorNumber !== 0) {
          throw new Error(apiResponse.errorMessage || `API error: ${apiResponse.errorNumber}`);
        }

        if (apiResponse.body === null || apiResponse.body === undefined) {
          throw new Error('API returned empty body');
        }

        return apiResponse.body;
      } catch (error) {
        lastError = error;
        const isAxios = axios.isAxiosError(error);
        const status = isAxios ? error.response?.status : undefined;
        const shouldRetry = attempt < MAX_RETRIES &&
          (status === undefined || RETRY_STATUSES.includes(status));

        if (shouldRetry) {
          const backoff = 250 * (attempt + 1);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        if (isAxios) {
          if (error.response) {
            const apiResponse = error.response.data as ApiResponse<unknown>;
            throw new Error(
              apiResponse?.errorMessage || `HTTP ${error.response.status}: ${error.response.statusText}`,
            );
          }
          throw new Error(`Network error: ${error.message}`);
        }
        throw error;
      }
    }

    throw lastError as Error;
  }

  /**
   * Get current user information
   */
  async getUser(): Promise<User> {
    return this.request<User>({
      method: 'GET',
      url: '/User',
    });
  }

  /**
   * List all locations (homes) the user has access to
   */
  async getLocations(): Promise<Location[]> {
    return this.request<Location[]>({
      method: 'GET',
      url: '/Location',
    });
  }

  /**
   * Get devices for a specific location
   */
  async getLocationDevices(locationId: string): Promise<DeviceSummary[]> {
    return this.request<DeviceSummary[]>({
      method: 'GET',
      url: `/Location/${locationId}/Devices`,
    });
  }

  /**
   * Set away mode for a location
   */
  async setLocationAwayMode(locationId: string, away: boolean): Promise<Location> {
    return this.request<Location>({
      method: 'PATCH',
      url: `/Location/${locationId}/State`,
      data: { awayState: away ? 1 : 0 },
    });
  }

  /**
   * Get device details and current status
   */
  async getDevice(deviceId: string): Promise<Device> {
    return this.request<Device>({
      method: 'GET',
      url: `/Device/${deviceId}`,
    });
  }

  /**
   * Update device settings
   */
  async updateDevice(deviceId: string, settings: DeviceSettings): Promise<Device> {
    return this.request<Device>({
      method: 'PATCH',
      url: `/Device/${deviceId}`,
      data: { Settings: settings },
    });
  }

  // Convenience methods for common operations

  /**
   * Set device temperature in Heat mode
   */
  async setDeviceHeatTemp(deviceId: string, temperature: number): Promise<Device> {
    return this.updateDevice(deviceId, { Heat: temperature });
  }

  /**
   * Set device temperature in Cool mode
   */
  async setDeviceCoolTemp(deviceId: string, temperature: number): Promise<Device> {
    return this.updateDevice(deviceId, { Cool: temperature });
  }

  /**
   * Set both heating and cooling thresholds for Auto mode
   */
  async setDeviceAutoTemps(deviceId: string, heatTemp: number, coolTemp: number): Promise<Device> {
    return this.updateDevice(deviceId, { Heat: heatTemp, Cool: coolTemp });
  }

  /**
   * Set device mode
   */
  async setDeviceMode(deviceId: string, mode: 'Off' | 'Heat' | 'Cool' | 'Auto'): Promise<Device> {
    return this.updateDevice(deviceId, { Mode: mode });
  }

  /**
   * Set device fan mode
   */
  async setDeviceFan(deviceId: string, fan: 'Auto' | 'On'): Promise<Device> {
    return this.updateDevice(deviceId, { Fan: fan });
  }

  /**
   * Set floor minimum temperature
   */
  async setDeviceFloorMin(deviceId: string, temperature: number): Promise<Device> {
    // Need to read current device to preserve existing Floor.W value
    const device = await this.getDevice(deviceId);

    return this.updateDevice(deviceId, {
      Schedule: {
        Floor: {
          W: temperature,
          A: device.data.Schedule.Floor.A, // Preserve away temp
        },
      },
    });
  }

  /**
   * Set device away temperature (for floor heating)
   */
  async setDeviceAwayTemp(deviceId: string, temperature: number | null): Promise<Device> {
    // temperature of 0 or null unsets away temp
    const awayTemp = temperature === null || temperature === 0 ? 0 : temperature;

    // Need to read current device to preserve existing Floor.W value
    const device = await this.getDevice(deviceId);

    return this.updateDevice(deviceId, {
      Schedule: {
        Floor: {
          W: device.data.Schedule.Floor.W, // Preserve floor minimum
          A: awayTemp,
        },
      },
    });
  }
}
