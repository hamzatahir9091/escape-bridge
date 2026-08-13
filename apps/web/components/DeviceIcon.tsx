"use client";

import Image from "next/image";
import type { DeviceType } from "../lib/deviceInfo";

interface DeviceIconProps {
  deviceType: DeviceType;
  size?: number;
}

const deviceImages: Record<DeviceType, string> = {
  iphone: "/iphone.png",
  ipad: "/ipad.png",

  "android-phone": "/android.png",
  "android-tablet": "/tablet.png",

  mac: "/apple-laptop-computer.png",
  windows: "/computer-screen.png",
  linux: "/computer-screen.png",

  unknown: "/computer-screen.png",
};

export default function DeviceIcon({
  deviceType,
  size = 40,
}: DeviceIconProps) {
  return (
    <Image
      src={deviceImages[deviceType]}
      alt={deviceType}
      width={size}
      height={size}
      style={{
        objectFit: "contain",
      }}
    />
  );
}