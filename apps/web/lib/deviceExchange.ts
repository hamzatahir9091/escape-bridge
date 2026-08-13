import type { DeviceInfo } from "./deviceInfo";

export const DEVICE_INFO_MESSAGE = "DEVICE_INFO";

export interface DeviceInfoMessage {
  type: typeof DEVICE_INFO_MESSAGE;
  payload: DeviceInfo;
}

export function createDeviceInfoMessage(
  deviceInfo: DeviceInfo
): string {
  const message: DeviceInfoMessage = {
    type: DEVICE_INFO_MESSAGE,
    payload: deviceInfo,
  };

  return JSON.stringify(message);
}

export function parseDeviceInfoMessage(
  message: string
): DeviceInfoMessage | null {
  try {
    const data = JSON.parse(message);

    if (data?.type !== DEVICE_INFO_MESSAGE) {
      return null;
    }

    return data as DeviceInfoMessage;
  } catch {
    return null;
  }
}