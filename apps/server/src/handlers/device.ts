import {
  DeviceRegisterMessage,
  MessageType,
} from "@bridge/shared";

import { WebSocket } from "ws";
import { devices } from "../store/devices";

export function handleDeviceRegister(
  socket: WebSocket,
  data: DeviceRegisterMessage
) {
  const { deviceId, deviceName } = data.payload;

  devices.set(deviceId, {
    deviceId,
    deviceName,
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
}