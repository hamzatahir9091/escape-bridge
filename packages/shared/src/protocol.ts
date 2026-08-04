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
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];


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

  payload:{
    code:string
  }
}


export interface SessionJoinedMessage {
  type: typeof MessageType.SESSION_JOINED;

  payload: {
    peerId: string;
  };
}

export type ServerMessage =
  | ClientIdMessage
  | SessionCreatedMessage
  | SessionJoinedMessage;

export type ClientMessage =
  | CreateSessionMessage
  | JoinSessionMessage;

export interface Session {
  host: string;

  guest?: string;
}