import { WebSocket } from "ws";
import { Session } from "@bridge/shared";

export const clients = new Map<string, WebSocket>();

export const sessions = new Map<string, Session>();


export interface RoomDevice {
  deviceId: string;
  deviceName: string;
  clientId: string | null;
  online: boolean;
}

export interface Room {
  code: string;
  hostDeviceId: string;
  devices: Map<string, RoomDevice>;
}

export const rooms = new Map<string, Room>();