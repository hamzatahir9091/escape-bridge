import {
  DeviceRegisterMessage,
  MessageType,
} from "@bridge/shared";

import { WebSocket } from "ws";
import { devices } from "../store/devices";
import { rooms, clients , Room } from "../store/state";

export function handleDeviceRegister(
  socket: WebSocket,
  clientId: string,
  data: DeviceRegisterMessage
) {
  const { deviceId, deviceName } = data.payload;

  // Device already exists in a room and is reconnecting
  devices.set(deviceId, {
    deviceId,
    deviceName,
    clientId,
    socket,
  });

  socket.send(
    JSON.stringify({
      type: MessageType.DEVICE_REGISTERED,
      payload: {
        deviceId,
      },
    })
  );

  console.log(
    `Device registered: ${deviceName} (${deviceId})`
  );

  // Check whether this device belongs to any room
  for (const room of rooms.values()) {
    const roomDevice = room.devices.get(deviceId);

    if (!roomDevice) {
      continue;
    }

    // Device has reconnected
    roomDevice.clientId = clientId;
    roomDevice.online = true;
    roomDevice.deviceName = deviceName;

    console.log(
      `🔄 Device reconnected to room ${room.code}: ${deviceName}`
    );

    const roomDevices = getRoomDevices(room);

    // Tell every currently online room member
    for (const member of room.devices.values()) {
      if (!member.online || !member.clientId) {
        continue;
      }

      const target = clients.get(member.clientId);

      if (target) {
        target.send(
          JSON.stringify({
            type: MessageType.ROOM_DEVICES_UPDATED,
            payload: {
              devices: roomDevices,
            },
          })
        );
      }
    }
  }
}



function getRoomDevices(room: Room) {
  return Array.from(room.devices.values()).map((device) => ({
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    online: device.online,
    isHost: device.deviceId === room.hostDeviceId,
  }));
}