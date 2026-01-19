# Homebridge Tekmar WiFi

Homebridge plugin and CLI tool for controlling Tekmar WiFi thermostats (561/562/563/564 series) via the Watts Home API, enabling integration with Apple HomeKit.

## Features

- ✅ **Homebridge Plugin**: Full HomeKit integration for all Tekmar thermostats
- ✅ **Full API Support**: Complete implementation of Watts Home API
- ✅ **CLI Tool**: Command-line interface for testing and device control
- ✅ **Authentication**: Programmatic OAuth 2.0 login with automatic token refresh
- ✅ **Device Control**: Temperature, mode, fan, away mode, and floor heating controls
- ✅ **Auto Discovery**: Automatically discovers all thermostats across all locations

## Installation

### Homebridge Plugin Installation

1. **Install via Homebridge UI:**
   - Open Homebridge UI
   - Go to Plugins
   - Search for "homebridge-tekmar-wifi"
   - Click Install

2. **Or install via npm:**
   ```bash
   npm install -g homebridge-tekmar-wifi
   ```

3. **Configure the plugin:**
   Add the following to your Homebridge `config.json`:

   ```json
   {
     "platforms": [
       {
         "platform": "TekmarWiFi",
         "name": "Tekmar WiFi",
         "email": "your-email@example.com",
         "password": "your-password",
         "pollingInterval": 120,
         "debug": false
       }
     ]
   }
   ```

   **Configuration Options:**
   - `platform` (required): Must be `"TekmarWiFi"`
   - `name` (required): Display name for the platform
   - `email` (required): Your Watts Home account email
   - `password` (required): Your Watts Home account password
   - `pollingInterval` (optional): How often to poll device status in seconds (default: 120, min: 30, max: 600)
   - `debug` (optional): Enable debug logging (default: false)

4. **Restart Homebridge:**
   - The plugin will automatically discover all your Tekmar thermostats
   - Each thermostat will appear as a separate accessory in HomeKit

### Development Setup

For development or CLI usage:

```bash
# Clone the repository
git clone <repository-url>
cd homebridge-tekmar-wifi

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start

### Homebridge Plugin

Once installed and configured, the plugin will:
1. Authenticate with your Watts Home account
2. Discover all locations and thermostats
3. Create HomeKit accessories for each thermostat
4. Automatically update device status via polling

All thermostats will appear in the Home app and can be controlled via Siri, HomeKit automations, and the Home app.

### CLI Tool

1. **Login:**
   ```bash
   node dist/cli/index.js login
   ```
   Enter your Watts Home account credentials when prompted.

2. **List Locations:**
   ```bash
   node dist/cli/index.js locations list
   ```

3. **List Devices:**
   ```bash
   node dist/cli/index.js devices list <location-id>
   ```

4. **Control Device:**
   ```bash
   # Set temperature
   node dist/cli/index.js devices temp <device-id> 72
   
   # Change mode
   node dist/cli/index.js devices mode <device-id> auto
   ```

See [SETUP.md](SETUP.md) for complete CLI usage documentation.

### Library Usage

The library can be imported for use in Homebridge plugins or other Node.js applications:

```typescript
import { WattsAuth, WattsApiClient } from 'homebridge-tekmar-wifi';

const auth = new WattsAuth();
const api = new WattsApiClient(auth);

// Authenticate
await auth.login(email, password);

// Get locations and devices
const locations = await api.getLocations();
const devices = await api.getLocationDevices(locationId);

// Control device
await api.setDeviceMode(deviceId, 'Auto');
await api.setDeviceTemperature(deviceId, 72, 75);
```

## API Documentation

- [API Endpoints](docs/API_ENDPOINTS.md) - Complete API reference
- [Authentication](docs/AUTHENTICATION.md) - OAuth 2.0 flow details
- [HomeKit Mapping](docs/HOMEKIT_MAPPING.md) - HomeKit characteristic mapping
- [Homebridge Requirements](docs/HOMEBRIDGE_REQUIREMENTS_CHECKLIST.md) - Feature checklist

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── auth.ts          # Authentication client
│   │   │   └── client.ts         # API client
│   │   └── logger.ts             # Logging utility
│   ├── cli/
│   │   └── index.ts              # CLI entry point
│   ├── types/
│   │   └── api.ts                # TypeScript definitions
│   ├── platform.ts                # Homebridge platform class
│   ├── platformAccessory.ts       # Thermostat accessory implementation
│   ├── settings.ts                # Platform constants
│   └── index.ts                   # Plugin entry point & library exports
├── config.schema.json             # Homebridge configuration schema
├── docs/                          # API documentation
├── dist/                          # Compiled JavaScript (generated)
└── tokens.json                    # Stored tokens (git-ignored, CLI only)
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Clean build artifacts
npm run clean
```

## Security

- **Homebridge Plugin**: Authentication tokens are stored securely in Homebridge's storage directory with restricted file permissions (600)
- **CLI Tool**: Authentication tokens are stored in `tokens.json` in the current working directory (git-ignored)
- Never commit tokens, credentials, or personal information
- Tokens automatically refresh when expired
- All sensitive data is redacted from documentation

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:
- Follow existing code style
- Add tests for new features
- Update documentation
- Keep sensitive information redacted

## Disclaimer

This project is for educational and interoperability purposes. Users should:
- Review Tekmar/Watts terms of service
- Use at their own risk
- Respect rate limits and API usage policies
- Not use for commercial purposes without authorization

---

## HomeKit Features

The plugin exposes the following HomeKit characteristics for each thermostat:

- **Current Temperature**: Real-time room temperature
- **Target Temperature**: Set desired temperature
- **Current Heating/Cooling State**: Shows if system is heating, cooling, or off
- **Target Heating/Cooling State**: Set mode (Off, Heat, Cool, Auto)
- **Heating Threshold Temperature**: Lower bound for Auto mode
- **Cooling Threshold Temperature**: Upper bound for Auto mode
- **Temperature Display Units**: Automatically matches device settings (Celsius/Fahrenheit)

## Troubleshooting

### Plugin Not Discovering Devices

1. Check your email and password in the Homebridge config
2. Enable debug logging: Set `"debug": true` in config
3. Check Homebridge logs for authentication errors
4. Verify your Watts Home account has access to the thermostats

### Devices Not Responding

1. Check if thermostats are online in the Watts Home app
2. Verify network connectivity
3. Check Homebridge logs for API errors
4. Try increasing the `pollingInterval` if you're experiencing rate limiting

### CLI Tool Issues

- CLI uses separate token storage (in current working directory)
- Run `watts-cli login` to authenticate separately from Homebridge
- See [SETUP.md](SETUP.md) for detailed CLI usage

---

**Status:** ✅ Homebridge plugin fully implemented and ready for use
