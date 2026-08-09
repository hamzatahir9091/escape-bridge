import {
    CreateRoomMessage,
    JoinRoomMessage,
    MessageType,
} from "@bridge/shared";

import { WebSocket } from "ws";
import { rooms, Room, clients } from "../store/state";
import { generateSessionCode } from "../utils/generateCode";

export function handleCreateRoom(socket: WebSocket, clientId: string, deviceId: string, deviceName: string) {

    // creting ccod efor the room 
    let code = generateSessionCode()

    // verifying uniqueness of code
    while (rooms.has(code)) {
        code = generateSessionCode()
    }

    const room = {
        code,
        hostDeviceId: deviceId,
        devices: new Map()
    }

    room.devices.set(deviceId, {
        deviceId,
        deviceName,
        clientId,
        online: true,
    });

    rooms.set(code, room)

    socket.send(
        JSON.stringify({
            type: MessageType.ROOM_CREATED,
            payload: {
                code,
            },
        })
    );

    console.log(
        `Room created: ${code} by ${deviceName}`
    );

}


export function handleJoinRoom(socket: WebSocket,
    clientId: string,
    deviceId: string,
    deviceName: string,
    data: JoinRoomMessage) {

    const room = rooms.get(data.payload.code)

    if (!room) {
        console.log("Room not found with the room code :", data.payload.code);
        return;
    }

    room.devices.set(deviceId, {
        deviceId,
        deviceName,
        clientId,
        online: true,
    });

    const devices = getRoomDevices(room);

    socket.send(
        JSON.stringify({
            type: MessageType.ROOM_JOINED,
            payload: {
                code: room.code,
                devices,
            },
        })
    );

    for (const roomDevice of room.devices.values()) {
        if (
            roomDevice.clientId &&
            roomDevice.clientId !== clientId
        ) {
            const target = clients.get(roomDevice.clientId);

            if (target) {
                target.send(
                    JSON.stringify({
                        type: MessageType.ROOM_DEVICES_UPDATED,
                        payload: {
                            devices,
                        },
                    })
                );
            }
        }
    }
    console.log(
        `${deviceName} joined room ${room.code}`
    );
}


export function handleDeviceDisconnect(
    deviceId: string,
    clientId: string
) {
    for (const room of rooms.values()) {
        const roomDevice = room.devices.get(deviceId);

        if (!roomDevice) {
            continue;
        }

        // Make sure this is the connection that actually disconnected
        if (roomDevice.clientId !== clientId) {
            continue;
        }

        roomDevice.online = false;
        roomDevice.clientId = null;

        console.log(
            `Device ${deviceId} went offline in room ${room.code}`
        );

        const devices = getRoomDevices(room);

        // Notify all currently connected room members
        for (const device of room.devices.values()) {
            if (!device.online || !device.clientId) {
                continue;
            }

            const target = clients.get(device.clientId);

            if (target) {
                target.send(
                    JSON.stringify({
                        type: MessageType.ROOM_DEVICES_UPDATED,
                        payload: {
                            devices,
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