"use client";

import { useEffect, useState } from "react";

export type DeviceType =
  | "IPHONE"
  | "ANDROID_PHONE"
  | "ANDROID_TABLET"
  | "IPAD"
  | "WINDOWS_PC"
  | "WINDOWS_LAPTOP"
  | "MAC"
  | "COMPUTER"
  | "UNKNOWN";

export type DeviceInfo = {
  deviceType: DeviceType;

  platform: string;
  browser: string;

  userAgent: string;

  userAgentData: {
    mobile: boolean;
    platform: string;
    brands: {
      brand: string;
      version: string;
    }[];
  } | null;

  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    pixelRatio: number;
  };

  window: {
    width: number;
    height: number;
  };

  touch: {
    maxTouchPoints: number;
    hasTouch: boolean;
  };

  hardware: {
    cpuCores: number | undefined;
    memoryGB: number | "Not supported";
  };

  connection: {
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  } | null;

  browserInfo: {
    cookiesEnabled: boolean;
    online: boolean;
  };
};

function detectBrowser(userAgent: string): string {
  if (userAgent.includes("Edg/")) {
    return "Edge";
  }

  if (userAgent.includes("OPR/")) {
    return "Opera";
  }

  if (userAgent.includes("CriOS/")) {
    return "Chrome";
  }

  if (userAgent.includes("Chrome/")) {
    return "Chrome";
  }

  if (userAgent.includes("FxiOS/")) {
    return "Firefox";
  }

  if (userAgent.includes("Firefox/")) {
    return "Firefox";
  }

  if (
    userAgent.includes("Safari/") &&
    !userAgent.includes("Chrome") &&
    !userAgent.includes("CriOS")
  ) {
    return "Safari";
  }

  return "Unknown";
}

function detectDeviceType(nav: any): DeviceType {
  const userAgent = nav.userAgent.toLowerCase();
  const platform = nav.platform?.toLowerCase() ?? "";

  const mobile = nav.userAgentData?.mobile;
  const maxTouchPoints = nav.maxTouchPoints ?? 0;

  /*
   * ==========================
   * iPHONE
   * ==========================
   */

  if (
    platform.includes("iphone") ||
    userAgent.includes("iphone")
  ) {
    return "IPHONE";
  }

  /*
   * ==========================
   * ANDROID
   * ==========================
   */

  if (platform.includes("android") || userAgent.includes("android")) {
    /*
     * Chrome's User-Agent Client Hints gives us
     * a very useful mobile signal.
     */

    if (mobile === true) {
      return "ANDROID_PHONE";
    }

    /*
     * Android + touch + mobile=false
     * matched our tested Android tablet.
     */

    if (mobile === false && maxTouchPoints > 0) {
      return "ANDROID_TABLET";
    }

    /*
     * Firefox and other browsers may not expose
     * userAgentData, so use the User-Agent too.
     */

    if (userAgent.includes("mobile")) {
      return "ANDROID_PHONE";
    }

    if (maxTouchPoints > 0) {
      return "ANDROID_TABLET";
    }
  }

  /*
   * ==========================
   * WINDOWS
   * ==========================
   */

  if (
    platform.includes("win") ||
    userAgent.includes("windows")
  ) {
    /*
     * We currently only have real data for
     * a Windows desktop PC.
     *
     * Tomorrow, when we get Windows laptop
     * data, we can improve this branch.
     */

    if (
      maxTouchPoints === 0 &&
      window.screen.width >= 1600
    ) {
      return "WINDOWS_PC";
    }

    return "COMPUTER";
  }

  /*
   * ==========================
   * OTHER COMPUTERS
   * ==========================
   */

  if (maxTouchPoints === 0) {
    return "COMPUTER";
  }

  return "UNKNOWN";
}

export function DeviceDetector({
  onDetected,
}: {
  onDetected?: (info: DeviceInfo) => void;
}) {
  const [deviceInfo, setDeviceInfo] =
    useState<DeviceInfo | null>(null);

  useEffect(() => {
    const nav = navigator as any;

    const userAgent = nav.userAgent;

    const userAgentData = nav.userAgentData
      ? {
          mobile: nav.userAgentData.mobile,
          platform: nav.userAgentData.platform,
          brands: nav.userAgentData.brands,
        }
      : null;

    const connection = nav.connection
      ? {
          effectiveType: nav.connection.effectiveType,
          downlink: nav.connection.downlink,
          rtt: nav.connection.rtt,
          saveData: nav.connection.saveData,
        }
      : null;

    const info: DeviceInfo = {
      deviceType: detectDeviceType(nav),

      platform: nav.userAgentData?.platform || nav.platform,

      browser: detectBrowser(userAgent),

      userAgent,

      userAgentData,

      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        pixelRatio: window.devicePixelRatio,
      },

      window: {
        width: window.innerWidth,
        height: window.innerHeight,
      },

      touch: {
        maxTouchPoints: nav.maxTouchPoints ?? 0,
        hasTouch: "ontouchstart" in window,
      },

      hardware: {
        cpuCores: nav.hardwareConcurrency,
        memoryGB: nav.deviceMemory ?? "Not supported",
      },

      connection,

      browserInfo: {
        cookiesEnabled: nav.cookieEnabled,
        online: nav.onLine,
      },
    };

    setDeviceInfo(info);

    onDetected?.(info);
  }, [onDetected]);

  if (!deviceInfo) {
    return null;
  }

  /*
   * Temporary UI for testing.
   *
   * We can remove this later and only
   * return the data to the main app.
   */

  return (
    <pre
      style={{
        marginTop: "30px",
        padding: "20px",
        background: "#111",
        color: "#fff",
        borderRadius: "12px",
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontSize: "14px",
        lineHeight: "1.6",
      }}
    >
      {JSON.stringify(deviceInfo, null, 2)}
    </pre>
  );
}