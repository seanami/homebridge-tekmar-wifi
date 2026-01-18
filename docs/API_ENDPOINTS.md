# API Endpoints Reference

> **Status:** 🟢 DOCUMENTED - Fully reverse engineered!
> 
> **Last Updated:** 2026-01-18

This document provides a comprehensive reference for all discovered Watts Home API endpoints.

---

## Base URL

```
https://home.watts.com/api/
```

## Required Headers

All API requests require:

```http
Authorization: Bearer [ACCESS_TOKEN]
Api-Version: 2.0
Content-Type: application/json
```

---

## User Management Endpoints

### GET /api/User
**Status:** 🟢 Documented and tested

Get current user information.

**Request:**
```http
GET /api/User HTTP/1.1
Host: home.watts.com
Authorization: Bearer [TOKEN]
Api-Version: 2.0
```

**Response:**
```json
{
  "errorNumber": 0,
  "errorMessage": null,
  "body": {
    "userId": "db933c88-8744-469f-912c-272f36f29302",
    "emailAddress": "user@example.com",
    "defaultLocationId": "0c1c1706-43e5-4e54-a66d-15fe9f7a65ad",
    "languagePreference": "en",
    "userTypeId": 1,
    "measurementScale": "I",
    "mobilePhoneNumber": null,
    "firstName": "Sean",
    "lastName": "McBride",
    "smsNotificationEnabled": false,
    "emailNotificationEnabled": false,
    "pushNotificationEnabled": false,
    "defaultLocationDevices": [],
    "voiceControlPlatform": "None"
  }
}
```

**Fields:**
- `measurementScale`: `"I"` for Imperial (Fahrenheit), `"M"` for Metric (Celsius)
- `userTypeId`: `1` = Owner, `4` = Shared user

---

### GET /api/User/Preferences
**Status:** 🟡 Discovered but not yet tested

Get user preferences (temperature units, notifications, etc.)

---

### PATCH /api/User
**Status:** 🟡 Discovered but not yet tested

Update user profile or preferences.

---

## Location (Home) Management Endpoints

### GET /api/Location
**Status:** 🟢 Documented and tested

List all locations (homes) the user has access to.

**Request:**
```http
GET /api/Location HTTP/1.1
Host: home.watts.com
Authorization: Bearer [TOKEN]
Api-Version: 2.0
```

**Response:**
```json
{
  "errorNumber": 0,
  "errorMessage": null,
  "body": [
    {
      "locationId": "bb643b20-6a65-48ed-9153-43e7582bd837",
      "ownerId": "aa34f624-5458-4495-aafd-2647b70d09c3",
      "name": "Home",
      "address": {
        "address": "123 Main St",
        "address2": "",
        "city": "San Francisco",
        "state_province": "CA",
        "zipcode": "94114",
        "country": "US"
      },
      "awayState": 0,
      "isDefault": false,
      "isShared": true,
      "userType": 4,
      "supportsAway": true,
      "usersCount": 2,
      "devicesCount": 5,
      "hasDeviceInDemandResponseEvent": false
    }
  ]
}
```

**Fields:**
- `awayState`: `0` = Home, other values TBD
- `userType`: `1` = Owner, `4` = Shared user
- `supportsAway`: Whether location supports away mode
- `devicesCount`: Number of devices at this location

---

### GET /api/Location/{locationId}
**Status:** 🟡 Discovered but not yet tested

Get details for a specific location.

---

## Device Management Endpoints

### GET /api/Device/{deviceId}
**Status:** 🟢 Documented and tested

Get complete device status and configuration.

**Request:**
```http
GET /api/Device/baee7842-ec00-5e95-af3a-63bc70d9a97d HTTP/1.1
Host: home.watts.com
Authorization: Bearer [TOKEN]
Api-Version: 2.0
```

**Response:**
```json
{
  "errorNumber": 0,
  "errorMessage": null,
  "body": {
    "deviceId": "baee7842-ec00-5e95-af3a-63bc70d9a97d",
    "name": "3rd Floor",
    "modelId": 7,
    "modelNumber": "562",
    "deviceType": "Thermostat",
    "deviceTypeId": 2,
    "isConnected": true,
    "isShared": false,
    "requestingUser": "db933c88-8744-469f-912c-272f36f29302",
    "location": {
      "locationId": "bb643b20-6a65-48ed-9153-43e7582bd837",
      "name": "Home",
      "awayState": 0,
      "userType": 1
    },
    "data": {
      "Sensors": {
        "Room": {"Val": 74, "Status": "Okay"},
        "Floor": {"Val": 73, "Status": "Okay"},
        "Outdoor": {"Val": 53, "Status": "Okay"}
      },
      "State": {
        "Op": "Off",
        "Sub": "None"
      },
      "Mode": {
        "Active": 1,
        "Val": "Heat",
        "Enum": ["Off", "Heat", "Cool", "Auto"]
      },
      "Target": {
        "Active": 1,
        "Sensor": "Room",
        "Hold": 0,
        "Heat": 70,
        "Cool": 100,
        "Min": 40,
        "Max": 100,
        "Steps": 1
      },
      "TempInterlock": 2.0,
      "Fan": {
        "Active": 1,
        "Val": "Auto",
        "Enum": ["Auto", "On"],
        "Relay": 0
      },
      "TempUnits": {
        "Active": 1,
        "Val": "F",
        "Enum": ["F", "C"]
      },
      "Units": "Imperial",
      "SchedEnable": {
        "Active": 1,
        "Val": "Off",
        "Enum": ["Off", "On"]
      },
      "Schedule": {
        "SchedActive": 0,
        "HeatActive": 1,
        "CoolActive": 1,
        "FloorActive": 1,
        "Grp": null,
        "Event": null,
        "Floor": {"W": 71, "A": 0},
        "HeatMin": 40,
        "HeatMax": 95,
        "CoolMin": 45,
        "CoolMax": 100,
        "FloorMin": 40,
        "FloorMax": 85,
        "TempSteps": 1,
        "TimeSteps": 10
      },
      "Energy": {
        "Heat": {
          "Daily": [1.5, 0.0, 0.0, 0.0, 0.0, 0.0, 1.1],
          "Monthly": [23.6, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 12.9]
        },
        "Cool": {
          "Daily": [0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
          "Monthly": [0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        }
      },
      "DateTime": "2026-01-18T06:28:19Z",
      "TZOffset": -28800
    }
  }
}
```

**Key Fields:**
- `isConnected`: Whether device is online
- `State.Op`: Current operation - `"Off"`, `"Heating"`, `"Cooling"`
- `Mode.Val`: Current mode - `"Off"`, `"Heat"`, `"Cool"`, `"Auto"`
- `Target.Heat`: Heat setpoint temperature
- `Target.Cool`: Cool setpoint temperature
- `Sensors.Room.Val`: Current room temperature
- `Sensors.Floor.Val`: Current floor temperature (if available)
- `Sensors.Outdoor.Val`: Outdoor temperature (if available)

---

### PATCH /api/Device/{deviceId}
**Status:** 🟢 Documented and tested

Update device settings (temperature, mode, schedules, etc.)

**Request:**
```http
PATCH /api/Device/baee7842-ec00-5e95-af3a-63bc70d9a97d HTTP/1.1
Host: home.watts.com
Authorization: Bearer [TOKEN]
Api-Version: 2.0
Content-Type: application/json

{JSON_PAYLOAD}
```

**Response:** Returns the same structure as `GET /api/Device/{deviceId}` with updated values.

---

## Thermostat Control Operations

### Set Target Temperature

**PATCH /api/Device/{deviceId}**

```json
{"Settings": {"Heat": 70.0}}
```

For cooling:
```json
{"Settings": {"Cool": 75.0}}
```

**Temperature Ranges:**
- Heat: 40°F - 95°F
- Cool: 45°F - 100°F
- Step size: 1°F

---

### Change HVAC Mode

**PATCH /api/Device/{deviceId}**

```json
{"Settings": {"Mode": "Heat"}}
```

**Available Modes:**
- `"Off"` - System off
- `"Heat"` - Heating mode
- `"Cool"` - Cooling mode
- `"Auto"` - Automatic mode (heat or cool as needed)

---

### Set Floor Temperature

**PATCH /api/Device/{deviceId}**

```json
{"Settings": {"Schedule": {"Floor": {"W": 70.0, "A": 0.0}}}}
```

**Fields:**
- `W`: Warmth/target floor temperature (40°F - 85°F)
- `A`: Unknown (possibly "Active" or "Away" override)

---

### Change Fan Mode

**PATCH /api/Device/{deviceId}** *(Not yet tested)*

```json
{"Settings": {"Fan": "On"}}
```

**Available Modes:**
- `"Auto"` - Fan runs only when heating/cooling
- `"On"` - Fan runs continuously

---

### Enable/Disable Schedule

**PATCH /api/Device/{deviceId}** *(Not yet tested)*

```json
{"Settings": {"SchedEnable": "On"}}
```

---

## Response Format

All API responses follow this format:

```json
{
  "errorNumber": 0,
  "errorMessage": null,
  "body": {
    // Actual response data
  }
}
```

**Error Handling:**
- `errorNumber = 0`: Success
- `errorNumber != 0`: Error occurred, check `errorMessage`

---

## Additional Endpoints Discovered

These endpoints exist but haven't been fully tested yet:

- ❓ `GET /api/Location/{locationId}/Devices` - Get all devices for a location
- ❓ `PATCH /api/Location/{locationId}` - Update location (possibly for away mode?)
- ❓ Full schedule CRUD operations
- ❓ Device naming/configuration
- ❓ Sharing/permission management

---

## Notes

1. **No Azure IoT Hub Direct Access:** All communication goes through the REST API. The thermostats communicate with Azure IoT Hub on the backend, but the mobile app doesn't access it directly.

2. **Polling Required:** There's no webhook or WebSocket for real-time updates. The app polls `GET /api/Device/{deviceId}` periodically.

3. **Batch Operations:** Unknown if you can update multiple devices in one request.

4. **Rate Limiting:** Unknown, but should implement reasonable polling intervals (30-60 seconds).

5. **Device State Caching:** The API returns full device state on every PATCH, so you can update your local cache immediately.

---

*See `research/API_SUMMARY.md` for a quick reference guide.*

