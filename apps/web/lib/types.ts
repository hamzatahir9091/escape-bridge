import { type DeviceInfo } from "../lib/deviceInfo"

export type P2PMessage = {
  id: string;
  text: string;
  direction: "sent" | "received";
};

export type RoomMessage = {
  id: string;
  senderDeviceId: string;
  senderDeviceName: string;
  text: string;
  direction: "sent" | "received";

  // File transfer fields
  fileTransfer?: boolean
  fileName?: string
  progress?: number
};

export type RoomDevice = {
  deviceId: string;
  deviceName: string;
  online: boolean;
  isHost: boolean;
};

export type RoomState = {
  roomCode: string;
  devices: RoomDevice[];
  peerStatus: Record<string, boolean>;
  peers: Map<string, RTCPeerConnection>;
  dataChannels: Map<string, RTCDataChannel>;
  pendingCandidates: Map<string, RTCIceCandidateInit[]>;
  messages: RoomMessage[];
  selectedFiles: Record<string, File | null>;
  peerTimers: Map<string, ReturnType<typeof setTimeout>>;
  deviceMessages: Record<string, string>;
  remoteDeviceInfo: Record<string, DeviceInfo>
};

export type IncomingFileTransfer = {
  transferId: string;
  messageId: string
  data: ArrayBuffer[];
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  receivedChunks: number;
  startTime: number;
};