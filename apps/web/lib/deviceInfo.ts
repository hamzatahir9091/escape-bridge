export type DeviceType =
  | "iphone"
  | "ipad"
  | "android-phone"
  | "android-tablet"
  | "windows"
  | "mac"
  | "linux"
  | "unknown";

export type BrowserType =
  | "chrome"
  | "firefox"
  | "safari"
  | "edge"
  | "opera"
  | "unknown";

export interface DeviceInfo {
  deviceType: DeviceType;
  browser: BrowserType;
  os: string;
  isMobile: boolean;
  isTablet: boolean;
}

export function getLocalDeviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
      platform?: string;
      brands?: {
        brand: string;
        version: string;
      }[];
    };
  };

  const ua = nav.userAgent.toLowerCase();

  const platform =
    nav.userAgentData?.platform?.toLowerCase() ||
    nav.platform.toLowerCase();

  const isTouchDevice =
    nav.maxTouchPoints > 0 ||
    "ontouchstart" in window;

  /*
   * =========================
   * DEVICE TYPE
   * =========================
   */

  let deviceType: DeviceType = "unknown";

  const isIPhone = /iphone/.test(ua);

  const isIPad =
    /ipad/.test(ua) ||
    (
      /macintosh/.test(ua) &&
      isTouchDevice &&
      nav.maxTouchPoints > 1
    );

  const isAndroid = /android/.test(ua);

  if (isIPhone) {
    deviceType = "iphone";
  } else if (isIPad) {
    deviceType = "ipad";
  } else if (isAndroid) {
    /*
     * Android tablets generally don't contain "mobile"
     * in their user agent.
     */
    if (/mobile/.test(ua)) {
      deviceType = "android-phone";
    } else {
      deviceType = "android-tablet";
    }
  } else if (/windows/.test(ua) || platform.includes("win")) {
    deviceType = "windows";
  } else if (/macintosh|mac os x/.test(ua) || platform.includes("mac")) {
    deviceType = "mac";
  } else if (/linux/.test(ua) || platform.includes("linux")) {
    deviceType = "linux";
  }

  /*
   * =========================
   * BROWSER
   * =========================
   */

  let browser: BrowserType = "unknown";

  if (/edg\//.test(ua)) {
    browser = "edge";
  } else if (/opr\//.test(ua)) {
    browser = "opera";
  } else if (/firefox\//.test(ua)) {
    browser = "firefox";
  } else if (/crios\//.test(ua)) {
    browser = "chrome";
  } else if (/chrome\//.test(ua)) {
    browser = "chrome";
  } else if (/safari\//.test(ua) && !/chrome|crios/.test(ua)) {
    browser = "safari";
  }

  /*
   * =========================
   * MOBILE / TABLET
   * =========================
   */

  const isMobile =
    deviceType === "iphone" ||
    deviceType === "android-phone";

  const isTablet =
    deviceType === "ipad" ||
    deviceType === "android-tablet";

  /*
   * =========================
   * OS
   * =========================
   */

  let os = "Unknown";

  if (
    deviceType === "iphone" ||
    deviceType === "ipad"
  ) {
    os = "iOS";
  } else if (deviceType === "android-phone" || deviceType === "android-tablet") {
    os = "Android";
  } else if (deviceType === "windows") {
    os = "Windows";
  } else if (deviceType === "mac") {
    os = "macOS";
  } else if (deviceType === "linux") {
    os = "Linux";
  }

  return {
    deviceType,
    browser,
    os,
    isMobile,
    isTablet,
  };
}