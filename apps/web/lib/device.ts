const DEVICE_ID_KEY = "bridge_device_id";

export function getDeviceID(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)

  if (!deviceId) {
    deviceId = crypto.randomUUID();

    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }

  return deviceId
}

export function hasDeviceID(): boolean {
  return localStorage.getItem(DEVICE_ID_KEY) !== null;
}

const DEVICE_NAME_KEY = "bridge_device_name";

export function getDeviceName(): string | null {
  return localStorage.getItem(DEVICE_NAME_KEY);
}

export function setDeviceName(name: string) {
  localStorage.setItem(DEVICE_NAME_KEY, name);
}



// device detection logic
export type DeviceType =
  | "IPHONE"
  | "IPAD"
  | "ANDROID_PHONE"
  | "ANDROID_TABLET"
  | "WINDOWS_PC"
  | "MAC"
  | "COMPUTER"
  | "UNKNOWN";

export function getDeviceType(): DeviceType {
  const nav = navigator as Navigator & {
    userAgentData?: {
      mobile: boolean;
      platform: string;
    };
  };

  const ua = nav.userAgent.toLowerCase();
  const platform = nav.platform.toLowerCase();
  const touchPoints = nav.maxTouchPoints;

  if (ua.includes("iphone") || platform.includes("iphone")) {
    return "IPHONE";
  }

  if (
    ua.includes("ipad") ||
    platform.includes("ipad") ||
    (platform === "macintel" && touchPoints > 1)
  ) {
    return "IPAD";
  }

  if (ua.includes("android")) {
    if (
      nav.userAgentData?.mobile === true ||
      ua.includes("mobile")
    ) {
      return "ANDROID_PHONE";
    }

    return "ANDROID_TABLET";
  }

  if (
    ua.includes("windows") ||
    platform.includes("win")
  ) {
    return "WINDOWS_PC";
  }

  if (
    ua.includes("mac os") ||
    platform.includes("mac")
  ) {
    return "MAC";
  }

  if (touchPoints === 0) {
    return "COMPUTER";
  }

  return "UNKNOWN";
}