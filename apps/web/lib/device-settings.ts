export type DeviceSettings = {
  terminalName: string;
  receiptWidth: '58' | '80';
  autoPrint: boolean;
  cashDrawerMode: 'MANUAL' | 'PRINTER';
  customerDisplay: boolean;
};

export const defaultDeviceSettings: DeviceSettings = {
  terminalName: 'Main POS',
  receiptWidth: '80',
  autoPrint: false,
  cashDrawerMode: 'MANUAL',
  customerDisplay: false,
};

const key = 'pos_device_settings';

export function getDeviceSettings(): DeviceSettings {
  if (typeof window === 'undefined') return defaultDeviceSettings;
  try {
    return {
      ...defaultDeviceSettings,
      ...JSON.parse(localStorage.getItem(key) ?? '{}'),
    };
  } catch {
    return defaultDeviceSettings;
  }
}

export function saveDeviceSettings(settings: DeviceSettings) {
  localStorage.setItem(key, JSON.stringify(settings));
}
