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

export type ServerMessage =
  | ClientIdMessage
  | SessionCreatedMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | SessionJoinedMessage;

export type ClientMessage =
  | CreateSessionMessage
  | JoinSessionMessage
  | OfferMessage
  | IceCandidateMessage
  | AnswerMessage;

export interface Session {
  host: string;
  guest?: string;
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