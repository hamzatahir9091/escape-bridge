import {
  RoomOfferMessage,
  RoomAnswerMessage,
  RoomIceCandidateMessage,
  MessageType,
} from "@bridge/shared";

import { WebSocket } from "ws";
import { clients, rooms } from "../store/state.js";

function findRoomTarget(
  senderClientId: string,
  targetDeviceId: string
) {
  for (const room of rooms.values()) {

    const sender = [...room.devices.values()].find(
      (device) => device.clientId === senderClientId
    );

    if (!sender) {
      continue;
    }

    const target = room.devices.get(targetDeviceId);

    if (!target || !target.online || !target.clientId) {
      return null;
    }

    return target.clientId;
  }

  return null;
}


export function handleRoomOffer(
  clientId: string,
  data: RoomOfferMessage
) {
  const targetClientId = findRoomTarget(
    clientId,
    data.payload.targetDeviceId
  );

  if (!targetClientId) {
    console.log("Room offer target not found");
    return;
  }

  const target = clients.get(targetClientId);

  if (!target) {
    console.log("Room offer target socket not found");
    return;
  }

  target.send(JSON.stringify(data));

  console.log(
    `Room OFFER forwarded → ${data.payload.targetDeviceId}`
  );
}

export function handleRoomAnswer(
  clientId: string,
  data: RoomAnswerMessage
) {
  const targetClientId = findRoomTarget(
    clientId,
    data.payload.targetDeviceId
  );

  if (!targetClientId) {
    console.log("Room answer target not found");
    return;
  }

  const target = clients.get(targetClientId);

  if (!target) {
    return;
  }

  target.send(JSON.stringify(data));

  console.log(
    `Room ANSWER forwarded → ${data.payload.targetDeviceId}`
  );
}

export function handleRoomIceCandidate(
  clientId: string,
  data: RoomIceCandidateMessage
) {
  const targetClientId = findRoomTarget(
    clientId,
    data.payload.targetDeviceId
  );

  if (!targetClientId) {
    console.log("Room ICE target not found");
    return;
  }

  const target = clients.get(targetClientId);

  if (!target) {
    return;
  }

  target.send(JSON.stringify(data));

  console.log(
    `Room ICE forwarded → ${data.payload.targetDeviceId}`
  );
}