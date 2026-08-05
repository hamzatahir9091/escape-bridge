import { WebSocket } from "ws";
import { Session } from "@bridge/shared";

export const clients = new Map<string, WebSocket>();

export const sessions = new Map<string, Session>();