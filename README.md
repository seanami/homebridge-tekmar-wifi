# Homebridge Tekmar WiFi

Homebridge plugin and CLI tool for controlling Tekmar WiFi thermostats (561/562/563/564 series) via the Watts Home API, enabling integration with Apple HomeKit.

## Features

- ✅ **Full API Support**: Complete implementation of Watts Home API
- ✅ **CLI Tool**: Command-line interface for testing and device control
- ✅ **HomeKit Ready**: Library structure designed for Homebridge plugin development
- ✅ **Authentication**: Programmatic OAuth 2.0 login with automatic token refresh
- ✅ **Device Control**: Temperature, mode, fan, away mode, and floor heating controls

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

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
│   └── index.ts                   # Library exports
├── docs/                          # API documentation
├── dist/                          # Compiled JavaScript (generated)
└── tokens.json                    # Stored tokens (git-ignored)
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

- Authentication tokens are stored in `tokens.json` (git-ignored)
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

**Status:** ✅ API fully implemented and tested  
**Next Phase:** Homebridge plugin development
