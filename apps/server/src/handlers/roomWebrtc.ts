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
  roomCode: string,
  targetDeviceId: string
) {

  // we will use rooCode to find exact room instead of searching through each room that exists in server 
  const room = rooms.get(roomCode)

  if (!room) {
    console.log(`!!! Room not found : ${roomCode} `)
    return null;
  }

  // we make sure that sender actually belongs to this room 
  const sender = [...room.devices.values()].find((device) => {
    return device.clientId === senderClientId;
  })

  console.log("ROOM DEVICES:", [...room.devices.values()]);
  console.log("LOOKING FOR CLIENT:", senderClientId);

  if (!sender) {
    console.log(
      `Sender ${senderClientId} is not a member of room ${roomCode}`
    );
    return null;
  }

  // Find the target inside THIS room
  const target = room.devices.get(targetDeviceId);

  if (!target || !target.online || !target.clientId) {
    return null;
  }

  return target.clientId;

}


export function handleRoomOffer(
  clientId: string,
  data: RoomOfferMessage
) {
  const targetClientId = findRoomTarget(
    clientId,
    data.payload.roomCode,
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
    data.payload.roomCode,
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
    data.payload.roomCode,
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