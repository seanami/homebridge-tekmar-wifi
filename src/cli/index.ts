#!/usr/bin/env node

/**
 * Watts Home API CLI Tool
 * Thin CLI layer that uses the WattsApiClient library
 */

import { Command } from 'commander';
import * as readline from 'readline';
import * as path from 'path';
import { WattsAuth } from '../lib/api/auth.js';
import { WattsApiClient } from '../lib/api/client.js';

const program = new Command();

// Initialize auth and client
const auth = new WattsAuth();
const api = new WattsApiClient(auth);

// Helper to handle errors with log file info
function handleError(error: unknown, context: string): never {
  const err = error as { message?: string; response?: { status?: number; statusText?: string } };
  const logFile = path.join(process.cwd(), 'watts-cli.log');
  console.error(`\n${context}: ${err.message || 'Unknown error'}`);
  console.error(`\nDetailed error information has been logged to: ${logFile}`);
  if (err.response) {
    console.error(`HTTP Status: ${err.response.status} ${err.response.statusText || ''}`);
  }
  process.exit(1);
}


// Locations commands
const locationsCmd = new Command('locations')
  .description('Manage locations (homes)');

locationsCmd
  .command('list')
  .alias('ls')
  .description('List all locations')
  .action(async () => {
    try {
      const locations = await api.getLocations();
      console.log('\nLocations:');
      locations.forEach((loc) => {
        console.log(`  ${loc.locationId}`);
        console.log(`    Name: ${loc.name}`);
        console.log(`    Devices: ${loc.devicesCount}`);
        console.log(`    Away: ${loc.awayState === 1 ? 'Yes' : 'No'}`);
        console.log('');
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

locationsCmd
  .command('away <location-id> <on|off>')
  .description('Set away mode for a location')
  .action(async (locationId: string, state: string) => {
    try {
      const away = state.toLowerCase() === 'on';
      const location = await api.setLocationAwayMode(locationId, away);
      console.log(`\nLocation "${location.name}" away mode set to: ${away ? 'ON' : 'OFF'}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

// Devices commands
const devicesCmd = new Command('devices')
  .description('Manage devices');

devicesCmd
  .command('list <location-id>')
  .alias('ls')
  .description('List devices in a location')
  .action(async (locationId: string) => {
    try {
      const devices = await api.getLocationDevices(locationId);
      if (devices.length === 0) {
        console.log('\nNo devices found in this location.');
      } else {
        console.log('\nDevices:');
        devices.forEach((device) => {
          console.log(`  ${device.deviceId}`);
          console.log(`    Name: ${device.name}`);
          console.log(`    Type: ${device.deviceType}`);
          console.log(`    Model: ${device.modelNumber}`);
          console.log('');
        });
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

devicesCmd
  .command('status <device-id>')
  .description('Get device status')
  .action(async (deviceId: string) => {
    try {
      const device = await api.getDevice(deviceId);
      const data = device.data;

      console.log(`\nDevice: ${device.name}`);
      console.log(`  Connected: ${device.isConnected ? 'Yes' : 'No'}`);
      console.log(`  Mode: ${data.Mode.Val}`);
      console.log(`  State: ${data.State.Op}`);
      console.log(`  Current Temp: ${data.Sensors.Room.Val}°${data.TempUnits.Val}`);
      console.log(`  Heat Setpoint: ${data.Target.Heat}°${data.TempUnits.Val}`);
      console.log(`  Cool Setpoint: ${data.Target.Cool}°${data.TempUnits.Val}`);
      console.log(`  Fan: ${data.Fan.Val}`);
      if (data.Sensors.Floor) {
        console.log(`  Floor Temp: ${data.Sensors.Floor.Val}°${data.TempUnits.Val}`);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

// Temperature control
devicesCmd
  .command('temp <device-id> <temperature>')
  .description('Set temperature (uses current mode: heat or cool)')
  .action(async (deviceId: string, temp: string) => {
    try {
      const temperature = parseFloat(temp);
      const device = await api.getDevice(deviceId);

      const mode = device.data.Mode.Val;
      if (mode === 'Heat' || mode === 'Auto') {
        await api.setDeviceHeatTemp(deviceId, temperature);
        console.log(`\nSet heat temperature to ${temperature}°${device.data.TempUnits.Val}`);
      } else if (mode === 'Cool') {
        await api.setDeviceCoolTemp(deviceId, temperature);
        console.log(`\nSet cool temperature to ${temperature}°${device.data.TempUnits.Val}`);
      } else {
        console.error('Device must be in Heat, Cool, or Auto mode to set temperature');
        process.exit(1);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

devicesCmd
  .command('temp-heat <device-id> <temperature>')
  .description('Set heating temperature')
  .action(async (deviceId: string, temp: string) => {
    try {
      const temperature = parseFloat(temp);
      const device = await api.getDevice(deviceId);
      await api.setDeviceHeatTemp(deviceId, temperature);
      console.log(`\nSet heat temperature to ${temperature}°${device.data.TempUnits.Val}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

devicesCmd
  .command('temp-cool <device-id> <temperature>')
  .description('Set cooling temperature')
  .action(async (deviceId: string, temp: string) => {
    try {
      const temperature = parseFloat(temp);
      const device = await api.getDevice(deviceId);
      await api.setDeviceCoolTemp(deviceId, temperature);
      console.log(`\nSet cool temperature to ${temperature}°${device.data.TempUnits.Val}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

devicesCmd
  .command('temp-auto <device-id> <heat-temp> <cool-temp>')
  .description('Set both heating and cooling thresholds for Auto mode')
  .action(async (deviceId: string, heatTemp: string, coolTemp: string) => {
    try {
      const heat = parseFloat(heatTemp);
      const cool = parseFloat(coolTemp);
      const device = await api.getDevice(deviceId);
      await api.setDeviceAutoTemps(deviceId, heat, cool);
      console.log('\nSet Auto mode thresholds:');
      console.log(`  Heat: ${heat}°${device.data.TempUnits.Val}`);
      console.log(`  Cool: ${cool}°${device.data.TempUnits.Val}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

// Mode control
devicesCmd
  .command('mode <device-id> <off|heat|cool|auto>')
  .description('Set device mode')
  .action(async (deviceId: string, mode: string) => {
    try {
      const validMode = mode.toLowerCase();
      if (!['off', 'heat', 'cool', 'auto'].includes(validMode)) {
        console.error('Mode must be one of: off, heat, cool, auto');
        process.exit(1);
      }

      const modeValue = validMode.charAt(0).toUpperCase() + validMode.slice(1) as 'Off' | 'Heat' | 'Cool' | 'Auto';
      await api.setDeviceMode(deviceId, modeValue);
      console.log(`\nSet device mode to: ${modeValue}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

// Device settings
devicesCmd
  .command('floor-min <device-id> <temperature>')
  .description('Set floor minimum temperature')
  .action(async (deviceId: string, temp: string) => {
    try {
      const temperature = parseFloat(temp);
      const device = await api.getDevice(deviceId);
      await api.setDeviceFloorMin(deviceId, temperature);
      console.log(`\nSet floor minimum temperature to ${temperature}°${device.data.TempUnits.Val}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

devicesCmd
  .command('away-temp <device-id> <temperature>')
  .description('Set device away temperature (use 0 to unset)')
  .action(async (deviceId: string, temp: string) => {
    try {
      const temperature = parseFloat(temp);
      const awayTemp = temperature === 0 ? null : temperature;
      const device = await api.getDevice(deviceId);
      await api.setDeviceAwayTemp(deviceId, awayTemp);
      if (awayTemp === null) {
        console.log('\nUnset device away temperature');
      } else {
        console.log(`\nSet device away temperature to ${temperature}°${device.data.TempUnits.Val}`);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Error: ${err.message || 'Unknown error'}`);
      process.exit(1);
    }
  });

// Utility commands
program
  .command('login')
  .description('Login with email and password')
  .action(async () => {
    try {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const email = await new Promise<string>((resolve) => {
        rl.question('Email: ', resolve);
      });

      const password = await new Promise<string>((resolve) => {
        rl.question('Password: ', (pwd) => {
          rl.close();
          resolve(pwd);
        });
      });

      console.log('\nLogging in...');
      const tokens = await auth.login(email, password);
      console.log('Login successful!');
      console.log(`Token expires: ${new Date(tokens.expires_at * 1000).toLocaleString()}`);
    } catch (error: unknown) {
      handleError(error, 'Login failed');
    }
  });

program
  .command('refresh')
  .description('Manually refresh access token')
  .action(async () => {
    try {
      console.log('Refreshing token...');
      const tokens = await auth.refreshToken();
      console.log('Token refreshed successfully!');
      console.log(`Token expires: ${new Date(tokens.expires_at * 1000).toLocaleString()}`);
    } catch (error: unknown) {
      handleError(error, 'Token refresh failed');
    }
  });

// Main program setup
program
  .name('watts-cli')
  .description('CLI tool for controlling Tekmar WiFi thermostats via Watts Home API')
  .version('0.1.0')
  .addCommand(locationsCmd)
  .addCommand(devicesCmd);

// Parse arguments and run
program.parse(process.argv);
