# Setup Instructions

> **Quick Start Guide** for setting up and using the Watts Home API CLI tool

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

---

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the TypeScript project:**
   ```bash
   npm run build
   ```

3. **Link the CLI tool (optional, for development):**
   ```bash
   npm link
   ```

   This allows you to run `watts-cli` from anywhere.

---

## First-Time Setup

### 1. Login

Run the login command to authenticate with your Watts Home account:

```bash
npm run build
node dist/cli/index.js login
```

Or if you've linked it:
```bash
watts-cli login
```

Enter your email and password when prompted. Tokens will be saved to `tokens.json` in the project directory (git-ignored).

### 2. List Locations

```bash
watts-cli locations list
```

This shows all locations (homes) you have access to, including their IDs and device counts.

### 3. List Devices

```bash
watts-cli devices list <location-id>
```

Replace `<location-id>` with one from the previous step. This shows all devices in that location.

---

## Usage Examples

### View Device Status
```bash
watts-cli devices status <device-id>
```

### Set Temperature
```bash
# Set heat temp (if in Heat or Auto mode)
watts-cli devices temp-heat <device-id> 72

# Set cool temp (if in Cool or Auto mode)
watts-cli devices temp-cool <device-id> 75

# Set both thresholds (Auto mode)
watts-cli devices temp-auto <device-id> 68 75
```

### Change Mode
```bash
watts-cli devices mode <device-id> auto
```

Available modes: `off`, `heat`, `cool`, `auto`

### Set Away Mode
```bash
# Set location away mode
watts-cli locations away <location-id> on
watts-cli locations away <location-id> off

# Set device away temperature
watts-cli devices away-temp <device-id> 62
watts-cli devices away-temp <device-id> 0  # Unset
```

### Set Floor Temperature Minimum
```bash
watts-cli devices floor-min <device-id> 65
```

---

## Available Commands

### Locations
- `watts-cli locations list` - List all locations
- `watts-cli locations away <id> <on|off>` - Set away mode

### Devices
- `watts-cli devices list <location-id>` - List devices in location
- `watts-cli devices status <device-id>` - Get device status
- `watts-cli devices temp <device-id> <temp>` - Set temp (uses current mode)
- `watts-cli devices temp-heat <device-id> <temp>` - Set heating temp
- `watts-cli devices temp-cool <device-id> <temp>` - Set cooling temp
- `watts-cli devices temp-auto <device-id> <heat> <cool>` - Set Auto thresholds
- `watts-cli devices mode <device-id> <mode>` - Set mode (off/heat/cool/auto)
- `watts-cli devices floor-min <device-id> <temp>` - Set floor minimum
- `watts-cli devices away-temp <device-id> <temp>` - Set away temp (0 to unset)

### Utility
- `watts-cli login` - Login with email/password
- `watts-cli refresh` - Manually refresh access token

---

## Project Structure

```
src/
  lib/
    api/
      auth.ts          # Authentication client (OAuth 2.0)
      client.ts        # API client (all HTTP requests)
  cli/
    index.ts           # Thin CLI layer
  types/
    api.ts             # TypeScript type definitions
  index.ts             # Library entry point (for Homebridge reuse)
tokens.json            # Stored tokens (git-ignored)
tsconfig.json          # TypeScript configuration
```

---

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Clean Build
```bash
npm run clean
npm run build
```

---

## Library Usage (for Homebridge Plugin)

The library can be imported and reused in the Homebridge plugin:

```typescript
import { WattsAuth, WattsApiClient } from './lib';

const auth = new WattsAuth();
const api = new WattsApiClient(auth);

// Use API methods
const locations = await api.getLocations();
const devices = await api.getLocationDevices(locationId);
const device = await api.getDevice(deviceId);
await api.setDeviceMode(deviceId, 'Auto');
```

---

*Last Updated: 2026-01-18*
