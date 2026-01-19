/**
 * TypeScript type definitions for the Watts Home API
 */

// Authentication Types
export interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  not_before: number;
  expires_in: number;
  expires_on: number;
  resource: string;
  scope: string;
  refresh_token: string;
  refresh_token_expires_in: number;
  client_info: string;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  refresh_token_expires_at: number;
}

// API Response Wrapper
export interface ApiResponse<T> {
  errorNumber: number;
  errorMessage: string | null;
  body: T;
}

// User Types
export interface User {
  userId: string;
  emailAddress: string;
  defaultLocationId: string;
  languagePreference: string;
  userTypeId: number;
  measurementScale: 'I' | 'M'; // Imperial or Metric
  mobilePhoneNumber: string | null;
  firstName: string;
  lastName: string;
  smsNotificationEnabled: boolean;
  emailNotificationEnabled: boolean;
  pushNotificationEnabled: boolean;
  defaultLocationDevices: string[];
  voiceControlPlatform: string;
}

// Location Types
export interface LocationAddress {
  address: string;
  address2: string;
  city: string;
  state_province: string;
  zipcode: string;
  country: string;
}

export interface Location {
  locationId: string;
  ownerId: string;
  name: string;
  address: LocationAddress;
  awayState: number; // 0 = Home, 1 = Away
  isDefault: boolean;
  isShared: boolean;
  userType: number; // 1 = Owner, 4 = Shared user
  supportsAway: boolean;
  usersCount: number;
  devicesCount: number;
  hasDeviceInDemandResponseEvent: boolean;
}

// Device Types
export interface DeviceSummary {
  deviceId: string;
  name: string;
  modelId: number;
  modelNumber: string;
  deviceType: string;
  deviceTypeId: number;
  location: {
    locationId: string;
    name: string;
    address: LocationAddress | null;
    awayState: number;
    userType: number;
  };
  imageUrl: string | null;
  isShared: boolean;
}

export interface DeviceSensors {
  Room: { Val: number; Status: string };
  Floor?: { Val: number; Status: string };
  Outdoor?: { Val: number; Status: string };
}

export interface DeviceState {
  Op: 'Off' | 'Heating' | 'Cooling';
  Sub: string;
}

export interface DeviceMode {
  Active: number;
  Val: 'Off' | 'Heat' | 'Cool' | 'Auto';
  Enum: ['Off', 'Heat', 'Cool', 'Auto'];
}

export interface DeviceTarget {
  Active: number;
  Sensor: string;
  Hold: number;
  Heat: number;
  Cool: number;
  Min: number;
  Max: number;
  Steps: number;
}

export interface DeviceFan {
  Active: number;
  Val: 'Auto' | 'On';
  Enum: ['Auto', 'On'];
  Relay: number;
}

export interface DeviceTempUnits {
  Active: number;
  Val: 'F' | 'C';
  Enum: ['F', 'C'];
}

export interface DeviceSchedule {
  SchedActive: number;
  HeatActive: number;
  CoolActive: number;
  FloorActive: number;
  Grp: unknown;
  Event: unknown;
  Grp1?: unknown;
  Grp2?: unknown;
  Grp3?: unknown;
  Grp4?: unknown;
  Grp5?: unknown;
  Grp6?: unknown;
  Grp7?: unknown;
  Floor: {
    W: number; // Floor minimum temp (W = "Warm"?)
    A: number; // Away temp (0 = not set)
  };
  HeatMin: number;
  HeatMax: number;
  CoolMin: number;
  CoolMax: number;
  FloorMin: number;
  FloorMax: number;
  TempSteps: number;
  TimeSteps: number;
}

export interface DeviceEnergy {
  Heat: {
    Daily: number[];
    Monthly: number[];
  };
  Cool: {
    Daily: number[];
    Monthly: number[];
  };
}

export interface DeviceData {
  Sensors: DeviceSensors;
  State: DeviceState;
  Mode: DeviceMode;
  Target: DeviceTarget;
  TempInterlock: number; // Minimum gap between heat and cool (2.0 = 2°F)
  Fan: DeviceFan;
  TempUnits: DeviceTempUnits;
  Units: 'Imperial' | 'Metric';
  SchedEnable: {
    Active: number;
    Val: 'Off' | 'On';
    Enum: ['Off', 'On'];
  };
  Schedule: DeviceSchedule;
  Energy: DeviceEnergy;
  DateTime: string; // ISO 8601
  TZOffset: number; // Timezone offset in seconds
}

export interface Device extends DeviceSummary {
  data: DeviceData;
  isConnected: boolean;
  requestingUser: string;
}

// Device Control Types
export interface DeviceSettings {
  Mode?: 'Off' | 'Heat' | 'Cool' | 'Auto';
  Heat?: number;
  Cool?: number;
  Fan?: 'Auto' | 'On';
  Schedule?: {
    Floor?: {
      W?: number; // Floor minimum temp
      A?: number; // Away temp (0 to unset)
    };
  };
}

// Location Control Types
export interface LocationStateUpdate {
  awayState: number; // 0 = Home, 1 = Away
}
