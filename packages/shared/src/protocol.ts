// export enum MessageType {
//   CLIENT_ID = "CLIENT_ID",

//   CREATE_SESSION = "CREATE_SESSION",

//   SESSION_CREATED = "SESSION_CREATED",

//   JOIN_SESSION = "JOIN_SESSION",

//   SESSION_JOINED = "SESSION_JOINED",
// }


export const MessageType = {
  CLIENT_ID: "CLIENT_ID",

  CREATE_SESSION: "CREATE_SESSION",
  SESSION_CREATED: "SESSION_CREATED",

  JOIN_SESSION: "JOIN_SESSION",
  SESSION_JOINED: "SESSION_JOINED",

  OFFER: "OFFER",
  ANSWER: "ANSWER",
  ICE_CANDIDATE: "ICE_CANDIDATE",

  FILE_START: "FILE_START",
  FILE_END: "FILE_END",

  DEVICE_REGISTER: "DEVICE_REGISTER",
  DEVICE_REGISTERED: "DEVICE_REGISTERED",

  CREATE_ROOM: "CREATE_ROOM",
  ROOM_CREATED: "ROOM_CREATED",

  JOIN_ROOM: "JOIN_ROOM",
  ROOM_JOINED: "ROOM_JOINED",
  ROOM_DEVICES_UPDATED: "ROOM_DEVICES_UPDATED",

  DEVICE_ONLINE: "DEVICE_ONLINE",
  DEVICE_OFFLINE: "DEVICE_OFFLINE",


  ROOM_OFFER: "ROOM_OFFER",
  ROOM_ANSWER: "ROOM_ANSWER",
  ROOM_ICE_CANDIDATE: "ROOM_ICE_CANDIDATE",
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];


export type ServerMessage =
  | ClientIdMessage
  | SessionCreatedMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | DeviceRegisteredMessage
  | RoomCreatedMessage
  | RoomJoinedMessage
  | DeviceOnlineMessage
  | DeviceOfflineMessage
  | RoomDevicesUpdatedMessage
  | SessionJoinedMessage
  | RoomOfferMessage
  | RoomAnswerMessage
  | RoomIceCandidateMessage;

export type ClientMessage =
  | CreateSessionMessage
  | JoinSessionMessage
  | OfferMessage
  | DeviceRegisterMessage
  | IceCandidateMessage
  | AnswerMessage
  | CreateRoomMessage
  | JoinRoomMessage
  | RoomOfferMessage
  | RoomAnswerMessage
  | RoomIceCandidateMessage;

export type DataChannelMessage =
  | FileStartMessage
  | FileEndMessage;

export interface ClientIdMessage {
  type: typeof MessageType.CLIENT_ID;

  payload: {
    clientId: string;
  };
}

export interface CreateSessionMessage {
  type: typeof MessageType.CREATE_SESSION;

  payload: {};
}

export interface SessionCreatedMessage {
  type: typeof MessageType.SESSION_CREATED;

  payload: {
    code: string;
  };
}


export interface JoinSessionMessage {
  type: typeof MessageType.JOIN_SESSION;

  payload: {
    code: string
  }
}


export interface SessionJoinedMessage {
  type: typeof MessageType.SESSION_JOINED;

  payload: {
    peerId: string;
    role: "HOST" | "GUEST"
  };
}

export interface OfferMessage {
  type: typeof MessageType.OFFER;

  payload: {
    targetId: string;
    offer: SDPDescription;
  };
}

export interface AnswerMessage {
  type: typeof MessageType.ANSWER;

  payload: {
    targetId: string;
    answer: SDPDescription;
  };
}


export interface IceCandidateMessage {
  type: typeof MessageType.ICE_CANDIDATE;

  payload: {
    targetId: string;
    candidate: ICECandidate;
  };
}

// export interface RoomOfferMessage {
//   type: typeof MessageType.ROOM_OFFER;

//   payload: {
//     roomCode: string;
//     targetClientId: string;
//     offer: SDPDescription;
//   };
// }

// export interface RoomAnswerMessage {
//   type: typeof MessageType.ROOM_ANSWER;

//   payload: {
//     roomCode: string;
//     targetClientId: string;
//     answer: SDPDescription;
//   };
// }

// export interface RoomIceCandidateMessage {
//   type: typeof MessageType.ROOM_ICE_CANDIDATE;

//   payload: {
//     roomCode: string;
//     targetClientId: string;
//     candidate: ICECandidate;
//   };
// }

export interface RoomOfferMessage {
  type: typeof MessageType.ROOM_OFFER;

  payload: {
    senderDeviceId: string;
    targetDeviceId: string;
    offer: SDPDescription;
  };
}
export interface RoomAnswerMessage {
  type: typeof MessageType.ROOM_ANSWER;

  payload: {
    senderDeviceId: string;
    targetDeviceId: string;
    answer: SDPDescription;
  };
}
export interface RoomIceCandidateMessage {
  type: typeof MessageType.ROOM_ICE_CANDIDATE;

  payload: {
    senderDeviceId: string;
    targetDeviceId: string;
    candidate: ICECandidate;
  };
}


export interface Session {
  host: string;
  guest?: string;
}

export interface RoomDevice {
  deviceId: string;
  deviceName: string;
  clientId: string | null;
  online: boolean;
  isHost: boolean;
}

export interface Room {
  code: string;
  hostDeviceId: string;
  devices: Map<string, RoomDevice>;
}


export interface SDPDescription {
  type: "offer" | "answer";
  sdp?: string;
}

export interface ICECandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}


export interface FileStartMessage {
  type: typeof MessageType.FILE_START;

  payload: {
    transferId: string;
    name: string;
    size: number;
    mimeType: string;
    totalChunks: number;
    chunkSize: number;
  };
}

export interface FileEndMessage {
  type: typeof MessageType.FILE_END;

  payload: {
    transferId: string;
  };
}

export interface FileChunkMessage {
  transferId: string;
  chunkIndex: number;
}

export interface DeviceRegisterMessage {
  type: typeof MessageType.DEVICE_REGISTER;

  payload: {
    deviceId: string;
    deviceName: string;
  };
}

export interface DeviceRegisteredMessage {
  type: typeof MessageType.DEVICE_REGISTERED;

  payload: {
    deviceId: string;
  };
}




export interface CreateRoomMessage {
  type: typeof MessageType.CREATE_ROOM;

  payload: {};
}

export interface RoomCreatedMessage {
  type: typeof MessageType.ROOM_CREATED;

  payload: {
    code: string;
  };
}

export interface JoinRoomMessage {
  type: typeof MessageType.JOIN_ROOM;

  payload: {
    code: string;
  };
}

export interface RoomJoinedMessage {
  type: typeof MessageType.ROOM_JOINED;

  payload: {
    code: string;
    devices: RoomDevice[];
  };
}

export interface RoomDevicesUpdatedMessage {
  type: typeof MessageType.ROOM_DEVICES_UPDATED;

  payload: {
    devices: RoomDevice[];
  };
}

export interface DeviceOnlineMessage {
  type: typeof MessageType.DEVICE_ONLINE;

  payload: {
    deviceId: string;
    deviceName: string;
  };
}


export interface DeviceOfflineMessage {
  type: typeof MessageType.DEVICE_OFFLINE;

  payload: {
    deviceId: string;
  };
}