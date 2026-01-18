# HomeKit Capability Mapping

> **Status:** 🟢 Mapped - API fully documented and tested!

This document maps Tekmar thermostat capabilities to HomeKit accessory characteristics based on the Watts Home API.

---

## Overview

HomeKit uses the **HAP (HomeKit Accessory Protocol)** to define accessories, services, and characteristics. This document provides the complete mapping from Tekmar thermostat API responses to HomeKit's Thermostat service.

---

## HomeKit Thermostat Service

### Required Characteristics

| HomeKit Characteristic | Tekmar API Mapping | Status |
|----------------------|-------------------|--------|
| **CurrentHeatingCoolingState** | `data.State.Op` | ✅ Mapped |
| **TargetHeatingCoolingState** | `data.Mode.Val` | ✅ Mapped |
| **CurrentTemperature** | `data.Sensors.Room.Val` | ✅ Mapped |
| **TargetTemperature** | `data.Target.Heat` or `data.Target.Cool` | ✅ Mapped |
| **TemperatureDisplayUnits** | `data.TempUnits.Val` | ✅ Mapped |

### Optional Characteristics

| HomeKit Characteristic | Tekmar API Mapping | Status | Priority |
|----------------------|-------------------|--------|----------|
| **CoolingThresholdTemperature** | `data.Target.Cool` | ✅ Mapped | High (for Auto mode) |
| **HeatingThresholdTemperature** | `data.Target.Heat` | ✅ Mapped | High (for Auto mode) |
| **Name** | `name` | ✅ Mapped | High |

---

## Characteristic Details

### CurrentHeatingCoolingState

**HomeKit Values:**
- `0` = OFF
- `1` = HEAT
- `2` = COOL

**Tekmar API Mapping:**
```typescript
// From: data.State.Op
const stateMap = {
  "Off": 0,        // HomeKit OFF
  "Heating": 1,    // HomeKit HEAT
  "Cooling": 2     // HomeKit COOL
};
```

**Implementation:**
```typescript
getCurrentHeatingCoolingState(): number {
  const op = device.data.State.Op;
  return stateMap[op] ?? 0; // Default to OFF if unknown
}
```

---

### TargetHeatingCoolingState

**HomeKit Values:**
- `0` = OFF
- `1` = HEAT
- `2` = COOL
- `3` = AUTO

**Tekmar API Mapping:**
```typescript
// From: data.Mode.Val
const modeMap = {
  "Off": 0,   // HomeKit OFF
  "Heat": 1,  // HomeKit HEAT
  "Cool": 2,  // HomeKit COOL
  "Auto": 3   // HomeKit AUTO
};
```

**Implementation:**
```typescript
getTargetHeatingCoolingState(): number {
  const mode = device.data.Mode.Val;
  return modeMap[mode] ?? 0;
}

async setTargetHeatingCoolingState(value: number) {
  const mode = ["Off", "Heat", "Cool", "Auto"][value];
  await api.setDeviceMode(deviceId, mode);
}
```

**Note:** Tekmar 562 supports all four modes: Off, Heat, Cool, and Auto.

---

### CurrentTemperature

**HomeKit:** Celsius (float)
**Range:** 0-100°C

**Tekmar API Mapping:**
```typescript
// From: data.Sensors.Room.Val
// Units: data.TempUnits.Val ("F" or "C")
const currentTemp = device.data.Sensors.Room.Val;
const units = device.data.TempUnits.Val;

// Convert to Celsius if needed
const tempC = units === "F" 
  ? (currentTemp - 32) * 5/9 
  : currentTemp;
```

**Implementation:**
```typescript
getCurrentTemperature(): number {
  const temp = device.data.Sensors.Room.Val;
  const units = device.data.TempUnits.Val;
  
  if (units === "F") {
    return (temp - 32) * 5/9; // Convert F to C
  }
  return temp; // Already in Celsius
}
```

**Additional Sensors Available:**
- `data.Sensors.Floor.Val` - Floor temperature (for radiant floor systems)
- `data.Sensors.Outdoor.Val` - Outdoor temperature (if sensor available)

---

### TargetTemperature

**HomeKit:** Celsius (float)
**Range:** 10-38°C (adjustable based on device)
**Step:** 0.1°C

**Tekmar API Mapping:**
```typescript
// Depends on current mode:
// - Heat mode: data.Target.Heat
// - Cool mode: data.Target.Cool
// - Auto mode: Use threshold temperatures instead
// - Off mode: Not applicable

const mode = device.data.Mode.Val;
let targetTemp: number;

if (mode === "Heat") {
  targetTemp = device.data.Target.Heat;
} else if (mode === "Cool") {
  targetTemp = device.data.Target.Cool;
} else {
  // Auto or Off - use appropriate threshold
  targetTemp = device.data.Target.Heat; // Default to heat threshold
}
```

**Temperature Ranges (from API):**
- **Heat:** 40°F - 95°F (4.4°C - 35°C)
- **Cool:** 45°F - 100°F (7.2°C - 37.8°C)
- **Step Size:** 1°F (0.56°C)

**Implementation:**
```typescript
getTargetTemperature(): number {
  const mode = device.data.Mode.Val;
  const units = device.data.TempUnits.Val;
  
  let temp: number;
  if (mode === "Heat") {
    temp = device.data.Target.Heat;
  } else if (mode === "Cool") {
    temp = device.data.Target.Cool;
  } else {
    // Auto mode - return heat threshold as primary target
    temp = device.data.Target.Heat;
  }
  
  // Convert to Celsius if needed
  return units === "F" ? (temp - 32) * 5/9 : temp;
}

async setTargetTemperature(value: number) {
  const units = device.data.TempUnits.Val;
  const temp = units === "F" ? (value * 9/5) + 32 : value;
  const mode = device.data.Mode.Val;
  
  if (mode === "Heat") {
    await api.setDeviceTemperature(deviceId, temp);
  } else if (mode === "Cool") {
    await api.setDeviceTemperature(deviceId, undefined, temp);
  } else if (mode === "Auto") {
    // In Auto mode, setting target temp should update heat threshold
    await api.setDeviceTemperature(deviceId, temp);
  }
}
```

---

### CoolingThresholdTemperature

**HomeKit:** Celsius (float)
**Range:** 10-35°C
**Step:** 0.1°C

**Tekmar API Mapping:**
```typescript
// From: data.Target.Cool
// Only relevant in Auto mode
const coolThreshold = device.data.Target.Cool;
```

**Implementation:**
```typescript
getCoolingThresholdTemperature(): number {
  const units = device.data.TempUnits.Val;
  const temp = device.data.Target.Cool;
  return units === "F" ? (temp - 32) * 5/9 : temp;
}

async setCoolingThresholdTemperature(value: number) {
  const units = device.data.TempUnits.Val;
  const temp = units === "F" ? (value * 9/5) + 32 : value;
  // In Auto mode, update cool threshold
  await api.setDeviceTemperature(deviceId, undefined, temp);
}
```

---

### HeatingThresholdTemperature

**HomeKit:** Celsius (float)
**Range:** 10-25°C
**Step:** 0.1°C

**Tekmar API Mapping:**
```typescript
// From: data.Target.Heat
// Only relevant in Auto mode
const heatThreshold = device.data.Target.Heat;
```

**Implementation:**
```typescript
getHeatingThresholdTemperature(): number {
  const units = device.data.TempUnits.Val;
  const temp = device.data.Target.Heat;
  return units === "F" ? (temp - 32) * 5/9 : temp;
}

async setHeatingThresholdTemperature(value: number) {
  const units = device.data.TempUnits.Val;
  const temp = units === "F" ? (value * 9/5) + 32 : value;
  // In Auto mode, update heat threshold
  await api.setDeviceTemperature(deviceId, temp);
}
```

**Note:** Tekmar API enforces a minimum gap (`TempInterlock`) between heat and cool setpoints (typically 2°F). When setting thresholds in Auto mode, ensure the gap is maintained.

---

### TemperatureDisplayUnits

**HomeKit Values:**
- `0` = Celsius
- `1` = Fahrenheit

**Tekmar API Mapping:**
```typescript
// From: data.TempUnits.Val
const unitsMap = {
  "C": 0,  // HomeKit Celsius
  "F": 1   // HomeKit Fahrenheit
};
```

**Implementation:**
```typescript
getTemperatureDisplayUnits(): number {
  const units = device.data.TempUnits.Val;
  return units === "C" ? 0 : 1;
}

async setTemperatureDisplayUnits(value: number) {
  // Note: This may require updating user preferences via API
  // Current API doesn't show direct device-level unit control
  // May need to use PATCH /api/User endpoint
}
```

**Note:** Temperature units appear to be set at the user level (`User.measurementScale: "I"` or `"M"`), not per-device. All devices for a user will use the same units.

---

## Additional Features

### Away Mode

**Tekmar API Support:**
- Location-level away mode: `PATCH /api/Location/{locationId}/State` with `{"awayState": 1}`
- Device-level away temperature: `data.Schedule.Floor.A` (0 = not set)

**HomeKit Mapping Options:**

**Option 1: Custom Switch (Recommended)**
- Create a custom "Away Mode" switch service
- Shows as separate accessory in Home app
- Controls location-level away state

**Option 2: Occupancy Sensor**
- Use HomeKit Occupancy Sensor service
- Occupied = Home (awayState: 0)
- Not Occupied = Away (awayState: 1)
- Can trigger temperature adjustments via automation

**Option 3: HomeKit Scenes**
- User creates Home/Away scenes
- Scenes trigger location away mode changes
- No separate accessory needed

**Implementation:**
```typescript
// Location-level away mode
async setAwayMode(isAway: boolean) {
  await api.setLocationAwayMode(locationId, isAway);
}

// Device-level away temperature
async setAwayTemperature(temp: number) {
  await api.setDeviceFloorMinTemp(deviceId, temp); // Uses Schedule.Floor.A
}
```

---

### Floor Heating

**Tekmar API Support:**
- Floor temperature sensor: `data.Sensors.Floor.Val`
- Floor minimum temperature: `data.Schedule.Floor.W` (40-85°F)
- Floor away temperature: `data.Schedule.Floor.A` (0 = not set)

**HomeKit Mapping:**
- Floor heating is not a standard HomeKit characteristic
- Can be exposed as a custom service or separate accessory
- Or handled via away mode temperature settings

**Implementation:**
```typescript
async setFloorMinimumTemperature(temp: number) {
  await api.setDeviceFloorMinTemp(deviceId, temp);
}
```

---

### Fan Control

**Tekmar API Support:**
- Fan mode: `data.Fan.Val` ("Auto" or "On")
- Fan relay state: `data.Fan.Relay` (0 or 1)

**HomeKit Mapping:**
- HomeKit doesn't have a standard Fan characteristic for thermostats
- Can be exposed as a separate Fan service accessory
- Or as a custom characteristic on the thermostat service

**Implementation:**
```typescript
async setFanMode(mode: "Auto" | "On") {
  await api.setDeviceMode(deviceId, mode); // Note: This may need a separate Fan endpoint
}
```

---

## Polling Strategy

### Recommended Polling Interval

**30-60 seconds** for device status updates.

**Rationale:**
- API has no webhook or WebSocket support
- Temperature changes are relatively slow
- Balance between responsiveness and API load

**Implementation:**
```typescript
class TekmarThermostatAccessory {
  private pollInterval: NodeJS.Timeout;
  
  startPolling() {
    this.pollInterval = setInterval(async () => {
      await this.updateDeviceStatus();
    }, 30000); // 30 seconds
  }
  
  async updateDeviceStatus() {
    const device = await api.getDeviceStatus(this.deviceId);
    this.updateCharacteristics(device);
  }
}
```

---

## Error Handling

### Connection Errors

**HomeKit Behavior:**
- Show accessory as "Not Responding"
- Retry connection automatically
- Log error for debugging

**Implementation:**
```typescript
async getCurrentTemperature() {
  try {
    const device = await api.getDeviceStatus(this.deviceId);
    return this.convertTemperature(device.data.Sensors.Room.Val);
  } catch (error) {
    this.log.error('Failed to get temperature:', error);
    throw new this.api.hap.HapStatusError(
      this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
    );
  }
}
```

### Invalid Values

**Validation:**
- Temperature ranges: Heat (40-95°F), Cool (45-100°F)
- Mode values: Must be one of ["Off", "Heat", "Cool", "Auto"]
- Auto mode: Ensure heat/cool gap meets `TempInterlock` requirement (2°F minimum)

**Implementation:**
```typescript
validateTemperature(mode: string, temp: number, units: string): boolean {
  const tempF = units === "C" ? (temp * 9/5) + 32 : temp;
  
  if (mode === "Heat") {
    return tempF >= 40 && tempF <= 95;
  } else if (mode === "Cool") {
    return tempF >= 45 && tempF <= 100;
  }
  return true;
}
```

---

## Performance Considerations

### Caching

Cache device state to reduce API calls:

```typescript
class TekmarThermostatAccessory {
  private cache = {
    device: null as Device | null,
    lastUpdate: 0,
    cacheTimeout: 5000 // 5 seconds
  };
  
  async getCachedDevice(): Promise<Device> {
    const now = Date.now();
    if (this.cache.device && (now - this.cache.lastUpdate) < this.cacheTimeout) {
      return this.cache.device;
    }
    
    const device = await api.getDeviceStatus(this.deviceId);
    this.cache.device = device;
    this.cache.lastUpdate = now;
    return device;
  }
}
```

**Note:** The API returns full device state on every PATCH, so you can update your local cache immediately after control operations.

---

## Homebridge Plugin Structure

```typescript
import { WattsAuth, WattsApiClient } from 'homebridge-tekmar-wifi';

class TekmarThermostatAccessory {
  private service: Service;
  private api: WattsApiClient;
  
  constructor(
    private platform: TekmarPlatform,
    private accessory: PlatformAccessory
  ) {
    this.api = platform.apiClient;
    
    // Get or create thermostat service
    this.service = this.accessory.getService(
      this.platform.Service.Thermostat
    ) || this.accessory.addService(
      this.platform.Service.Thermostat
    );
    
    // Set accessory name
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.context.device.name
    );
    
    // Register characteristic handlers
    this.registerHandlers();
    
    // Start polling
    this.startPolling();
  }
  
  private registerHandlers() {
    // Current Heating Cooling State
    this.service.getCharacteristic(
      this.platform.Characteristic.CurrentHeatingCoolingState
    ).onGet(this.getCurrentHeatingCoolingState.bind(this));
    
    // Target Heating Cooling State
    this.service.getCharacteristic(
      this.platform.Characteristic.TargetHeatingCoolingState
    )
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));
    
    // Current Temperature
    this.service.getCharacteristic(
      this.platform.Characteristic.CurrentTemperature
    ).onGet(this.getCurrentTemperature.bind(this));
    
    // Target Temperature
    this.service.getCharacteristic(
      this.platform.Characteristic.TargetTemperature
    )
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));
    
    // Cooling Threshold (for Auto mode)
    this.service.getCharacteristic(
      this.platform.Characteristic.CoolingThresholdTemperature
    )
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));
    
    // Heating Threshold (for Auto mode)
    this.service.getCharacteristic(
      this.platform.Characteristic.HeatingThresholdTemperature
    )
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));
    
    // Temperature Display Units
    this.service.getCharacteristic(
      this.platform.Characteristic.TemperatureDisplayUnits
    ).onGet(this.getTemperatureDisplayUnits.bind(this));
  }
  
  // Implementation methods (see above for details)
  private async getCurrentHeatingCoolingState(): Promise<number> { /* ... */ }
  private async getTargetHeatingCoolingState(): Promise<number> { /* ... */ }
  private async setTargetHeatingCoolingState(value: number): Promise<void> { /* ... */ }
  private async getCurrentTemperature(): Promise<number> { /* ... */ }
  private async getTargetTemperature(): Promise<number> { /* ... */ }
  private async setTargetTemperature(value: number): Promise<void> { /* ... */ }
  // ... etc
}
```

---

## Testing Checklist

### Manual Testing

- [x] View thermostat in Home app
- [x] Read current temperature
- [x] Set target temperature (Heat mode)
- [x] Set target temperature (Cool mode)
- [x] Set target temperature (Auto mode)
- [x] Change mode (Off/Heat/Cool/Auto)
- [x] Set heating threshold (Auto mode)
- [x] Set cooling threshold (Auto mode)
- [x] Verify temperature unit display
- [ ] Siri commands:
  - [ ] "What's the temperature?"
  - [ ] "Set thermostat to 70 degrees"
  - [ ] "Turn off the heat"
  - [ ] "Set thermostat to heat mode"
  - [ ] "Set thermostat to auto mode"

---

## References

- [HAP Specification](https://github.com/homebridge/HAP-NodeJS)
- [Homebridge Plugin Template](https://github.com/homebridge/homebridge-plugin-template)
- [HAP Thermostat Service](https://developers.homebridge.io/#/service/Thermostat)
- [API Endpoints Documentation](API_ENDPOINTS.md)
- [Authentication Documentation](AUTHENTICATION.md)

---

*Last Updated: 2026-01-18*  
*Status: ✅ Complete mapping based on fully documented API*
