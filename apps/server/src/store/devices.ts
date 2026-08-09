import { WebSocket } from "ws";

export interface Device {
  deviceId: string;
  deviceName: string;
  socket: WebSocket;
}

export const devices = new Map<string, Device>();