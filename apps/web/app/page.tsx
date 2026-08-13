"use client";

import { useEffect, useRef, useState } from "react";

import { MessageType } from "@bridge/shared";

// WEBRTC  imports
import { addIceCandidate, createAnswer, createDataChannel, createOffer, createPeerConnection, sendFile, setRemoteAnswer, setRemoteOffer } from "../lib/webrtc";
import { getDeviceID, hasDeviceID, getDeviceName, setDeviceName, } from "../lib/device";

import DeviceIcon from "../components/DeviceIcon";

import BinaryBridgeBackground from "../components/BinaryBridgeBackground";
import {
  getLocalDeviceInfo,
  type DeviceInfo,
} from "../lib/deviceInfo";


import {
  createDeviceInfoMessage,
  parseDeviceInfoMessage,
} from "../lib/deviceExchange";
import BinaryBridgeTowers from "../components/BinaryBridgeTowers";

export default function Home() {
  const socket = useRef<WebSocket | null>(null);
  const peerREF = useRef<RTCPeerConnection | null>(null)
  const myRole = useRef<"HOST" | "GUEST" | null>(null);
  const peerId = useRef<string | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);                // state to store the ice candidates if the offer-answer cyclis still in process
  const roomPendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const roomPeers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const roomDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());

  const incomingFiles = useRef<
    Map<
      string,
      {
        transferId: string;
        data: ArrayBuffer[];
        name: string;
        size: number;
        mimeType: string;
        totalChunks: number;
        chunkSize: number;
        receivedChunks: number;
        startTime: number;
      }
    >
  >(new Map());

  const roomPeerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );


  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");                                 // state for current message
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);     // state for storing chat messages
  const [dataChannelOpen, setDataChannelOpen] = useState(false);              // state for kkeping track of connection
  const [sessionCode, setSessionCode] = useState("");                         // usestate for storing the code from next browser
  const [selectedFile, setSelectedFile] = useState<File | null>(null)         // state for storing the current file
  const [roomCode, setRoomCode] = useState<string>("")
  const [roomDevices, setRoomDevices] = useState<
    {
      deviceId: string;
      deviceName: string;
      online: boolean;
      isHost: boolean;
    }[]
  >([]);
  const [roomPeerStatus, setRoomPeerStatus] = useState<Record<string, boolean>>({});

  const [needsDeviceSetup, setNeedsDeviceSetup] = useState(false);
  const [deviceName, setDeviceNameState] = useState("");

  const [activeTab, setActiveTab] = useState('room');
  const [deviceMessages, setDeviceMessages] = useState<Record<string, string>>({});


  const [deviceInfo, setDeviceInfo] =
    useState<DeviceInfo | null>(null);

  const [remoteDeviceInfo, setRemoteDeviceInfo] =
    useState<Record<string, DeviceInfo>>({});

  useEffect(() => {
    console.log("App started");

    const info = getLocalDeviceInfo();

    setDeviceInfo(info);


    if (!hasDeviceID()) {
      console.log("🆕 First visit — device setup required");

      setDeviceNameState(info.deviceType);

      setNeedsDeviceSetup(true);

      return;
    }

    connect();
    console.log('connection made , if didnt run')
  }, []);

  // WHOLE IMPLEMENTATION IS BELOW

  const connect = () => {

    // console.log("WS URL =", process.env.NEXT_PUBLIC_WS_URL);
    socket.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);


    socket.current.onopen = () => {
      setConnected(true);

      const deviceId = getDeviceID();
      const deviceName = getDeviceName()

      socket.current!.send(
        JSON.stringify({
          type: MessageType.DEVICE_REGISTER,
          payload: {
            deviceId,
            deviceName: deviceName,
          },
        })
      );
    };

    // when socket receive message do this
    socket.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case MessageType.CLIENT_ID:
          console.log("My Client ID:", data.payload.clientId);
          break;

        case MessageType.SESSION_CREATED:
          console.log("Session Code:", data.payload.code);
          break;

        case MessageType.SESSION_JOINED: {
          console.log("Connected to peer:", data.payload.peerId);

          peerREF.current = createPeerConnection((candidate) => {
            if (candidate) {
              socket.current?.send(
                JSON.stringify({
                  type: MessageType.ICE_CANDIDATE,

                  payload: {
                    targetId: peerId.current,
                    candidate,
                  },
                })
              );
            }
          });;

          myRole.current = data.payload.role;
          peerId.current = data.payload.peerId;

          // ONLY RUN THIS CODE IF ITS HOST BROWSER <-------------------------  ###
          if (myRole.current === "HOST") {

            dataChannel.current = createDataChannel(
              peerREF.current!,
              () => {
                setDataChannelOpen(true);
              },
              () => {
                setDataChannelOpen(false);
              },
              (message) => {
                if (typeof message === "string") {
                  const data = JSON.parse(message);

                  // -------------------------
                  // FILE START
                  // -------------------------

                  if (data.type === "FILE_START") {
                    const transferId = data.payload.transferId;

                    incomingFiles.current.set(peerId.current!, {
                      transferId,
                      data: [],
                      name: data.payload.name,
                      size: data.payload.size,
                      mimeType: data.payload.mimeType,
                      totalChunks: data.payload.totalChunks,
                      chunkSize: data.payload.chunkSize,
                      receivedChunks: 0,
                      startTime: performance.now(),
                    });

                    console.log(
                      `📥 Receiving ${data.payload.name}`
                    );

                    return;
                  }

                  // -------------------------
                  // FILE END
                  // -------------------------

                  if (data.type === "FILE_END") {
                    const transferId = data.payload.transferId;

                    const transfer =
                      incomingFiles.current.get(peerId.current!);

                    if (!transfer) {
                      console.error(
                        "Received FILE_END without FILE_START"
                      );
                      return;
                    }

                    if (transfer.transferId !== transferId) {
                      console.error("Transfer ID mismatch");
                      return;
                    }

                    if (
                      transfer.receivedChunks !==
                      transfer.totalChunks
                    ) {
                      console.error(
                        `Missing chunks: ${transfer.receivedChunks}/${transfer.totalChunks}`
                      );
                      return;
                    }

                    const endTime = performance.now();

                    const seconds = (
                      (endTime - transfer.startTime) /
                      1000
                    ).toFixed(2);

                    const blob = new Blob(
                      transfer.data,
                      {
                        type: transfer.mimeType,
                      }
                    );

                    const url =
                      URL.createObjectURL(blob);

                    const link =
                      document.createElement("a");

                    link.href = url;
                    link.download = transfer.name;

                    link.click();

                    URL.revokeObjectURL(url);

                    console.log(
                      `✅ Received ${transfer.name} in ${seconds}s`
                    );

                    setReceivedMessages((prev) => [
                      ...prev,
                      `📥 ${transfer.name} received in ${seconds}s`,
                    ]);

                    incomingFiles.current.delete(
                      peerId.current!
                    );

                    return;
                  }
                  // -------------------------
                  // CHAT MESSAGE
                  // -------------------------

                  if (data.type === "CHAT_MESSAGE") {
                    setReceivedMessages((prev) => [
                      ...prev,
                      `Remote: ${data.payload.text}`,
                    ]);

                    return;
                  }

                  console.log(
                    "Unknown DataChannel message:",
                    data
                  );

                  return;

                  return;
                }

                // -------------------------
                // BINARY CHUNK
                // -------------------------

                if (message instanceof ArrayBuffer) {
                  const transfer =
                    incomingFiles.current.get(
                      peerId.current!
                    );

                  if (!transfer) {
                    console.error(
                      "Received chunk but no active transfer exists"
                    );
                    return;
                  }

                  transfer.data.push(message);
                  transfer.receivedChunks++;

                  console.log(
                    `📥 Chunk ${transfer.receivedChunks}/${transfer.totalChunks}`
                  );
                }
              }
            );


            const offer = await createOffer(peerREF.current!);
            socket.current?.send(
              JSON.stringify({
                type: MessageType.OFFER,
                payload: {
                  targetId: peerId.current,
                  offer
                }
              })
            );

            console.log("Offer sent");
          }

          // ONLY RUN THIS CODE IF ITS GUEST BROWSER <-------------------------  ###
          if (myRole.current === "GUEST") {

            peerREF.current.ondatachannel = (event) => {
              const channel = event.channel;
              dataChannel.current = channel;

              channel.onopen = () => {
                console.log("🟢 DataChannel OPEN");
                setDataChannelOpen(true);
              };

              channel.onclose = () => {
                console.log("🔴 DataChannel CLOSED");
                setDataChannelOpen(false);
              };


              channel.onmessage = (event) => {

                if (typeof event.data === "string") {
                  const data = JSON.parse(event.data)

                  if (data.type === "FILE_START") {
                    incomingFiles.current.set(data.payload.transferId, {
                      transferId: data.payload.transferId,
                      data: [],
                      name: data.payload.name,
                      size: data.payload.size,
                      mimeType: data.payload.mimeType,
                      totalChunks: data.payload.totalChunks,
                      chunkSize: data.payload.chunkSize,
                      receivedChunks: 0,
                      startTime: performance.now(),
                    });
                    console.log(
                      `📥 Receiving ${data.name}`
                    );
                    return;
                  }

                  if (data.type === "FILE_END") {

                    const transfer = incomingFiles.current.get(data.payload.transferId);

                    if (!transfer) {
                      console.error(
                        "Received FILE_END without FILE_START"
                      );
                      return;
                    }

                    if (
                      data.payload.transferId !==
                      transfer.transferId
                    ) {
                      console.error("Transfer ID mismatch");
                      return;
                    }

                    if (transfer.receivedChunks !== transfer.totalChunks) {
                      console.error(`Missing chunks: ${transfer.receivedChunks}/${transfer.totalChunks}`);
                      return;
                    }


                    const endTime = performance.now();

                    const duration =
                      endTime - transfer.startTime;

                    const seconds =
                      (duration / 1000).toFixed(2);

                    setReceivedMessages((prev) => [
                      ...prev,
                      `📥 ${transfer.name} received in ${seconds}s`,
                    ]);

                    const blob = new Blob(transfer.data, { type: transfer.mimeType })

                    const url = URL.createObjectURL(blob)

                    const link =
                      document.createElement("a");

                    link.href = url;
                    link.download = transfer.name;

                    link.click();

                    URL.revokeObjectURL(url);

                    console.log(
                      `✅ Received ${transfer.name}`
                    );

                    incomingFiles.current.delete(data.payload.transferId);

                    return;
                  }


                  if (data.type === "CHAT_MESSAGE") {
                    setReceivedMessages((prev) => [
                      ...prev,
                      `Remote: ${data.payload.text}`,
                    ]);

                    return;
                  }

                  console.log(
                    "Unknown DataChannel message:",
                    data
                  );

                  return;

                  return;
                }

                if (event.data instanceof ArrayBuffer) {
                  console.log("📦 Binary chunk received");

                  if (incomingFiles.current.size === 0) {
                    console.error(
                      "Received chunk but no active transfer exists"
                    );
                    return;
                  }

                  if (incomingFiles.current.size > 1) {
                    console.error(
                      "Multiple active transfers detected"
                    );
                    return;
                  }

                  const transfer =
                    incomingFiles.current.values().next().value;

                  if (!transfer) {
                    return;
                  }

                  transfer.data.push(event.data);
                  transfer.receivedChunks++;

                  console.log(
                    `📥 Chunk ${transfer.receivedChunks}/${transfer.totalChunks}`
                  );
                }
              };
            };
          }

          break;
        }

        case MessageType.OFFER: {

          await setRemoteOffer(
            peerREF.current!,
            data.payload.offer
          );

          console.log("Offer received");

          await processPendingCandidates();

          const answer = await createAnswer(
            peerREF.current!
          );

          socket.current?.send(
            JSON.stringify({
              type: MessageType.ANSWER,

              payload: {
                targetId: peerId.current,
                answer
              }
            })
          );

          console.log("Answer sent");

          break;
        }

        case MessageType.ANSWER: {
          await setRemoteAnswer(
            peerREF.current!,
            data.payload.answer
          );

          console.log(data.payload.answer);

          processPendingCandidates();

          break;
        }

        case MessageType.ICE_CANDIDATE: {

          const candidate = data.payload.candidate

          if (!peerREF.current) {
            return;
          }

          if (peerREF.current?.remoteDescription) {
            // If we already know the remote side, add it immediately
            await addIceCandidate(peerREF.current, candidate);
          } else {
            // If not, put it in the waiting room
            pendingCandidates.current.push(candidate);
            console.log("⏳ ICE candidate queued - remoteDescription not set yet");
          }
          break;
        }

        case MessageType.ROOM_CREATED: {
          const code = data.payload.code;
          console.log("Room created:", code);
          setRoomCode(code);
          break;
        }

        case MessageType.ROOM_JOINED: {
          const code = data.payload.code;

          setRoomCode(code);
          setRoomDevices(data.payload.devices);

          for (const device of data.payload.devices) {
            if (
              device.deviceId !== getDeviceID() &&
              device.online
            ) {
              connectToRoomDevice(device);
            }
          }

          break;
        }

        case MessageType.ROOM_DEVICES_UPDATED: {
          console.log("Room devices updated");

          const devices = data.payload.devices;

          setRoomDevices(data.payload.devices);

          for (const device of devices) {
            if (device.online) {
              continue;
            }

            const deviceId = device.deviceId;

            // Close old peer
            const peer = roomPeers.current.get(deviceId);

            if (peer) {
              peer.close();
              roomPeers.current.delete(deviceId);

              console.log(
                `🧹 Removed stale peer → ${deviceId}`
              );
            }

            // Close old DataChannel
            const channel =
              roomDataChannels.current.get(deviceId);

            if (channel) {
              channel.close();
              roomDataChannels.current.delete(deviceId);

              console.log(
                `🧹 Removed stale DataChannel → ${deviceId}`
              );
            }

            // Remove pending ICE candidates
            roomPendingCandidates.current.delete(deviceId);

            // Remove connection status
            setRoomPeerStatus((prev) => {
              const updated = { ...prev };
              delete updated[deviceId];
              return updated;
            });
          }


          break;
        }

        case MessageType.ROOM_OFFER: {
          console.log(
            `📥 Room OFFER received from ${data.payload.senderDeviceId}`
          );

          const senderDeviceId = data.payload.senderDeviceId;

          // Don't create another peer if we already have one
          if (roomPeers.current.has(senderDeviceId)) {
            console.log(
              "Already have room peer:",
              senderDeviceId
            );
            break;
          }

          const peer = createPeerConnection((candidate) => {
            if (!candidate) {
              return;
            }

            socket.current?.send(
              JSON.stringify({
                type: MessageType.ROOM_ICE_CANDIDATE,
                payload: {
                  senderDeviceId: getDeviceID(),
                  targetDeviceId: senderDeviceId,
                  candidate,
                },
              })
            );
          });

          roomPeers.current.set(senderDeviceId, peer);

          peer.onconnectionstatechange = () => {
            console.log(
              `Room peer ${senderDeviceId}:`,
              peer.connectionState
            );

            setRoomPeerStatus((prev) => ({
              ...prev,
              [senderDeviceId]:
                peer.connectionState === "connected",
            }));
          };

          peer.ondatachannel = (event) => {
            const channel = event.channel;

            roomDataChannels.current.set(
              senderDeviceId,
              channel
            );

            channel.onopen = () => {
              console.log(
                `🟢 Room DataChannel OPEN → ${senderDeviceId}`
              );

              resetRoomPeerTimer(senderDeviceId);


              const info = getLocalDeviceInfo();

              channel.send(
                createDeviceInfoMessage(info)
              );

              console.log(
                `📱 Device info sent → ${senderDeviceId}`,
                info
              );
            };

            channel.onclose = () => {
              console.log(
                `🔴 Room DataChannel CLOSED → ${senderDeviceId}`
              );
            };

            channel.binaryType = "arraybuffer";

            channel.onmessage = (event) => {


              if (typeof event.data === "string") {
                const deviceInfoMessage =
                  parseDeviceInfoMessage(event.data);

                if (deviceInfoMessage) {
                  setRemoteDeviceInfo((prev) => ({
                    ...prev,
                    [senderDeviceId]:
                      deviceInfoMessage.payload,
                  }));

                  console.log(
                    `📱 Device info received ← ${senderDeviceId}`,
                    deviceInfoMessage.payload
                  );

                  return;
                }
              }


              handleIncomingFileMessage(
                senderDeviceId,
                event
              );
            };
          };

          await setRemoteOffer(
            peer,
            data.payload.offer
          );

          console.log(
            `✅ Room OFFER applied from ${senderDeviceId}`
          );

          await processRoomPendingCandidates(
            senderDeviceId,
            peer
          );

          const answer = await createAnswer(peer);

          socket.current?.send(
            JSON.stringify({
              type: MessageType.ROOM_ANSWER,
              payload: {
                senderDeviceId: getDeviceID(),
                targetDeviceId: data.payload.senderDeviceId,
                answer,
              },
            })
          );

          console.log(
            "📤 Room ANSWER sent →",
            data.payload.senderDeviceId
          );

          break;
        }

        case MessageType.ROOM_ANSWER: {
          const deviceId =
            data.payload.senderDeviceId;

          const peer =
            roomPeers.current.get(deviceId);

          if (!peer) {
            console.log(
              "Room peer not found for answer:",
              deviceId
            );
            break;
          }

          await setRemoteAnswer(
            peer,
            data.payload.answer
          );

          console.log(
            "✅ Room ANSWER applied from",
            deviceId
          );

          // Apply ICE candidates that arrived before the answer
          await processRoomPendingCandidates(
            deviceId,
            peer
          );

          break;
        }

        case MessageType.ROOM_ICE_CANDIDATE: {
          const senderDeviceId =
            data.payload.senderDeviceId;

          const candidate =
            data.payload.candidate;

          const peer =
            roomPeers.current.get(senderDeviceId);

          // Peer doesn't exist yet
          if (!peer) {
            console.log(
              "⏳ Room peer not created yet. Queueing ICE candidate:",
              senderDeviceId
            );

            const existing =
              roomPendingCandidates.current.get(
                senderDeviceId
              ) ?? [];

            existing.push(candidate);

            roomPendingCandidates.current.set(
              senderDeviceId,
              existing
            );

            break;
          }

          // Peer exists but remote description isn't ready yet
          if (!peer.remoteDescription) {
            console.log(
              "⏳ Remote description not ready. Queueing ICE candidate:",
              senderDeviceId
            );

            const existing =
              roomPendingCandidates.current.get(
                senderDeviceId
              ) ?? [];

            existing.push(candidate);

            roomPendingCandidates.current.set(
              senderDeviceId,
              existing
            );

            break;
          }

          // Everything is ready
          await addIceCandidate(
            peer,
            candidate
          );

          console.log(
            "✅ Room ICE candidate applied from",
            senderDeviceId
          );

          break;
        }
        default: {
          console.log("Unknown message:", data.type);
        }
      }

    };


    // when soxket closes dothis
    socket.current.onclose = () => {
      console.log("Disconnected");
      setConnected(false);
    };
  };

  const sendDataChannelMessage = () => {
    if (!dataChannel.current) {
      console.log("DataChannel doesn't exist");
      return;
    }

    if (dataChannel.current.readyState !== "open") {
      console.log("DataChannel isn't open");
      return;
    }

    if (!message.trim()) {
      return;
    }

    const payload = JSON.stringify({
      type: "CHAT_MESSAGE",
      payload: message
    });

    dataChannel.current.send(payload);

    setReceivedMessages((prev) => [
      ...prev,
      `You: ${message}`,
    ]);

    setMessage("");
  };


  const createSession = () => {
    socket.current?.send(
      JSON.stringify({
        type: MessageType.CREATE_SESSION,
        payload: {}
      })
    )
  }

  // function for sending message to server to join session created by other user
  const joinSession = () => {
    socket.current?.send(
      JSON.stringify(
        {
          type: MessageType.JOIN_SESSION,
          payload: {
            code: sessionCode
          }
        }
      )
    )
  }

  const processPendingCandidates = async () => {
    if (peerREF.current) {
      console.log(`Processing ${pendingCandidates.current.length} queued candidates`);
      for (const candidate of pendingCandidates.current) {
        await addIceCandidate(peerREF.current, candidate);
      }
      pendingCandidates.current = []; // Clear the queue
    }
  };

  const processRoomPendingCandidates = async (
    deviceId: string,
    peer: RTCPeerConnection
  ) => {
    const candidates =
      roomPendingCandidates.current.get(deviceId);

    if (!candidates || candidates.length === 0) {
      return;
    }

    console.log(
      `Processing ${candidates.length} queued ICE candidates for ${deviceId}`
    );

    for (const candidate of candidates) {
      await addIceCandidate(peer, candidate);
    }

    roomPendingCandidates.current.delete(deviceId);
  };

  const createRoom = () => {
    console.log('create room function ran')
    socket.current?.send(
      JSON.stringify({
        type: MessageType.CREATE_ROOM,
        payload: {},
      })
    );
  };

  const joinRoom = () => {
    if (!roomCode.trim()) {
      console.log('rooomcode not entered')
      return
    }

    socket.current?.send(
      JSON.stringify(
        {
          type: MessageType.JOIN_ROOM,
          payload: {
            code: roomCode.trim()
          }
        }
      )
    )
  }


  const connectToRoomDevice = async (
    device: {
      deviceId: string;
      deviceName: string;
      online: boolean;
      isHost: boolean;
    }
  ) => {

    if (!device.online) {
      return;
    }

    if (roomPeers.current.has(device.deviceId)) {
      console.log(
        "Already have room peer:",
        device.deviceId
      );
      return;
    }

    console.log(
      `🔗 Connecting to room device: ${device.deviceName}`
    );

    const peer = createPeerConnection((candidate) => {
      if (!candidate) {
        return;
      }

      socket.current?.send(
        JSON.stringify({
          type: MessageType.ROOM_ICE_CANDIDATE,
          payload: {
            senderDeviceId: getDeviceID(),
            targetDeviceId: device.deviceId,
            candidate,
          },
        })
      );
    });

    roomPeers.current.set(device.deviceId, peer);

    peer.onconnectionstatechange = () => {
      console.log(
        `Room peer ${device.deviceName}:`,
        peer.connectionState
      );

      setRoomPeerStatus((prev) => ({
        ...prev,
        [device.deviceId]:
          peer.connectionState === "connected",
      }));
    };


    const channel = peer.createDataChannel("bridge-room");

    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      console.log(
        `🟢 Room DataChannel OPEN → ${device.deviceName}`
      );

      resetRoomPeerTimer(device.deviceId);


      const info = getLocalDeviceInfo();

      channel.send(
        createDeviceInfoMessage(info)
      );

      console.log(
        `📱 Device info sent → ${device.deviceId}`,
        info
      );
    };

    channel.onclose = () => {
      console.log(
        `🔴 Room DataChannel CLOSED → ${device.deviceName}`
      );
    };

    channel.binaryType = "arraybuffer";

    channel.onmessage = (event) => {



      if (typeof event.data === "string") {
        const deviceInfoMessage =
          parseDeviceInfoMessage(event.data);

        if (deviceInfoMessage) {
          setRemoteDeviceInfo((prev) => ({
            ...prev,
            [device.deviceId]:
              deviceInfoMessage.payload,
          }));

          console.log(
            `📱 Device info received ← ${device.deviceId}`,
            deviceInfoMessage.payload
          );

          return;
        }
      }




      handleIncomingFileMessage(
        device.deviceId,
        event
      );
    };

    roomDataChannels.current.set(
      device.deviceId,
      channel
    );

    const offer = await createOffer(peer);

    socket.current?.send(
      JSON.stringify({
        type: MessageType.ROOM_OFFER,
        payload: {
          senderDeviceId: getDeviceID(),
          targetDeviceId: device.deviceId,
          offer,
        },
      })
    );

    console.log(
      `📤 Room OFFER sent → ${device.deviceName}`
    );

  };

  const ensureRoomConnection = async (
    device: {
      deviceId: string;
      deviceName: string;
      online: boolean;
      isHost: boolean;
    }
  ) => {
    // Device is offline — nothing to connect to
    if (!device.online) {
      return null;
    }

    // Already connected
    const existingChannel =
      roomDataChannels.current.get(device.deviceId);

    if (existingChannel?.readyState === "open") {
      console.log(
        `🟢 Connection already open → ${device.deviceName}`
      );

      return existingChannel;
    }

    // Connection is currently being established
    if (roomPeers.current.has(device.deviceId)) {
      console.log(
        `⏳ Connection already being established → ${device.deviceName}`
      );

      return null;
    }

    // No connection exists → create one
    console.log(
      `🔗 Connection needed → ${device.deviceName}`
    );

    await connectToRoomDevice(device);

    return null;
  };


  const disconnectFromRoomDevice = (
    deviceId: string
  ) => {



    const timer = roomPeerTimers.current.get(deviceId);

    if (timer) {
      clearTimeout(timer);
      roomPeerTimers.current.delete(deviceId);
    }

    const peer = roomPeers.current.get(deviceId);

    if (peer) {
      peer.close();
      roomPeers.current.delete(deviceId);
    }

    const channel =
      roomDataChannels.current.get(deviceId);

    if (channel) {
      channel.close();
      roomDataChannels.current.delete(deviceId);
    }

    roomPendingCandidates.current.delete(
      deviceId
    );

    setRoomPeerStatus((prev) => {
      const updated = { ...prev };
      delete updated[deviceId];
      return updated;
    });

    console.log(
      `🔴 Disconnected from room device: ${deviceId}`
    );
  };

  const resetRoomPeerTimer = (deviceId: string) => {
    // Clear the old timer
    const oldTimer = roomPeerTimers.current.get(deviceId);

    if (oldTimer) {
      clearTimeout(oldTimer);
    }

    // Start a fresh 5-minute timer
    const timer = setTimeout(() => {
      console.log(
        `⏰ Room peer inactive for 5 minutes → ${deviceId}`
      );

      disconnectFromRoomDevice(deviceId);
    }, 5 * 60 * 1000);

    roomPeerTimers.current.set(deviceId, timer);
  };

  const sendFileToRoomDevice = async (
    deviceId: string,
    file: File
  ) => {

    resetRoomPeerTimer(deviceId);


    const channel =
      roomDataChannels.current.get(deviceId);

    if (!channel) {
      console.log(
        "No DataChannel for this device"
      );
      return;
    }

    if (channel.readyState !== "open") {
      console.log(
        "Room DataChannel isn't open"
      );
      return;
    }

    try {
      await sendFile(
        channel,
        file,
        {
          onProgress: (
            sentBytes,
            totalBytes
          ) => {
            const percentage =
              Math.round(
                (sentBytes / totalBytes) * 100
              );

            console.log(
              `📤 ${deviceId}: ${percentage}%`
            );
          },
        }
      );

      console.log(
        `✅ File sent → ${deviceId}`
      );

    } catch (error) {
      console.error(
        "❌ Room file transfer failed:",
        error
      );
    }
  };

  const sendRoomMessage = async (
    device: {
      deviceId: string;
      deviceName: string;
      online: boolean;
      isHost: boolean;
    },
    text: string
  ) => {
    if (!text.trim()) {
      return;
    }

    const channel = await ensureRoomConnection(device);

    if (!channel || channel.readyState !== "open") {
      console.log(
        `⏳ Waiting for connection before sending → ${device.deviceName}`
      );
      return;
    }

    resetRoomPeerTimer(device.deviceId);

    const messagePayload = JSON.stringify({
      type: "CHAT_MESSAGE",
      payload: {
        text,
      },
    });

    channel.send(messagePayload);

    console.log(
      `📤 Message sent → ${device.deviceName}: ${text}`
    );
  };

  const handleIncomingFileMessage = (
    senderDeviceId: string,
    event: MessageEvent
  ) => {

    resetRoomPeerTimer(senderDeviceId);
    // =========================
    // STRING MESSAGE
    // =========================

    if (typeof event.data === "string") {
      const data = JSON.parse(event.data);

      // -------------------------
      // FILE START
      // -------------------------

      if (data.type === "FILE_START") {
        const transferId = data.payload.transferId;

        incomingFiles.current.set(senderDeviceId, {
          transferId,
          data: [],
          name: data.payload.name,
          size: data.payload.size,
          mimeType: data.payload.mimeType,
          totalChunks: data.payload.totalChunks,
          chunkSize: data.payload.chunkSize,
          receivedChunks: 0,
          startTime: performance.now(),
        });

        console.log(
          `📥 Receiving ${data.payload.name} from ${senderDeviceId}`);

        return;
      }

      // -------------------------
      // FILE END
      // -------------------------

      if (data.type === "FILE_END") {
        const transferId = data.payload.transferId;

        const transfer =
          incomingFiles.current.get(senderDeviceId);

        if (!transfer) {
          console.error(
            "Received FILE_END without FILE_START"
          );
          return;
        }

        if (
          transfer.receivedChunks !==
          transfer.totalChunks
        ) {
          console.error(
            `Missing chunks: ${transfer.receivedChunks}/${transfer.totalChunks}`
          );
          return;
        }

        const endTime = performance.now();

        const seconds = (
          (endTime - transfer.startTime) /
          1000
        ).toFixed(2);

        const blob = new Blob(
          transfer.data,
          {
            type: transfer.mimeType,
          }
        );

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = url;
        link.download = transfer.name;

        link.click();

        URL.revokeObjectURL(url);

        console.log(
          `✅ Received ${transfer.name} in ${seconds}s`
        );

        setReceivedMessages((prev) => [
          ...prev,
          `📥 ${transfer.name} received in ${seconds}s`,
        ]);

        // IMPORTANT:
        // Remove ONLY this transfer.
        incomingFiles.current.delete(
          senderDeviceId
        );

        return;
      }


      if (data.type === "CHAT_MESSAGE") {
        const device = roomDevices.find(
          (d) => d.deviceId === senderDeviceId
        );

        const name = device
          ? device.deviceName
          : "Remote";

        setReceivedMessages((prev) => [
          ...prev,
          `${name}: ${data.payload.text}`,
        ]);

        return;
      }

      return;
    }

    // =========================
    // BINARY CHUNK
    // =========================

    if (event.data instanceof ArrayBuffer) {
      console.log(
        `📦 Binary chunk received from ${senderDeviceId}`
      );

      const transfer =
        incomingFiles.current.get(senderDeviceId);

      if (!transfer) {
        console.error(
          `Received chunk from ${senderDeviceId}, but no active transfer exists`
        );
        return;
      }

      transfer.data.push(event.data);
      transfer.receivedChunks++;

      console.log(
        `📥 ${senderDeviceId}: Chunk ${transfer.receivedChunks}/${transfer.totalChunks}`
      );
    }
  };


  const handleDeviceSetup = () => {
    const name = deviceName.trim();

    if (!name) {
      return;
    }

    setDeviceName(name);

    // This creates and saves the device ID for the first time
    getDeviceID();

    setNeedsDeviceSetup(false);

    connect();
  };


  const resetStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  return (

    <div>

      <button
        onClick={resetStorage}
        style={{
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        Reset App Data
      </button>


      {needsDeviceSetup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#020617",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(420px, calc(100% - 40px))",
              padding: "32px",
              backgroundColor: "#090d16",
              border: "1px solid #1e293b",
              borderRadius: "20px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                color: "#f8fafc",
                fontSize: "24px",
                fontWeight: "700",
              }}
            >
              Welcome to BRIDGE
            </h2>

            <p
              style={{
                margin: "0 0 24px",
                color: "#94a3b8",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Give this device a name so you can easily recognize it when
              sharing files.
            </p>

            <input
              autoFocus
              value={deviceName}
              onChange={(e) => setDeviceNameState(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleDeviceSetup();
                }
              }}
              placeholder="Device name"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid #334155",
                backgroundColor: "#020617",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
                marginBottom: "12px",
              }}
            />

            <button
              onClick={handleDeviceSetup}
              disabled={!deviceName.trim()}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: deviceName.trim()
                  ? "#2563eb"
                  : "#1e293b",
                color: deviceName.trim()
                  ? "#ffffff"
                  : "#64748b",
                fontSize: "14px",
                fontWeight: "600",
                cursor: deviceName.trim()
                  ? "pointer"
                  : "not-allowed",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      <main style={{
        maxWidth: '760px',
        margin: '40px auto',
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        color: '#e2e8f0',
        backgroundColor: '#090d16',
        padding: '32px',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        border: '1px solid #1e293b'
      }}>


        {/* Top Navigation Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            backgroundColor: '#0f172a',
            padding: '4px',
            borderRadius: '14px',
            border: '1px solid #1e293b'
          }}>
            <button
              onClick={() => setActiveTab('room')}
              style={{
                padding: '10px 28px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'room' ? '#1e293b' : 'transparent',
                color: activeTab === 'room' ? '#38bdf8' : '#64748b',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'room' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Room
            </button>
            <button
              onClick={() => setActiveTab('p2p')}
              style={{
                padding: '10px 28px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'p2p' ? '#1e293b' : 'transparent',
                color: activeTab === 'p2p' ? '#38bdf8' : '#64748b',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'p2p' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              P2P
            </button>
          </div>
        </div>

        {/* Main Workspace */}
        <div>
          {activeTab === 'room' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Room Controls & Global File Bar */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '20px',
                backgroundColor: '#0f172a',
                borderRadius: '16px',
                border: '1px solid #1e293b'
              }}>
                {/* Room Connect / Create Bar */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="Enter Room Code"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #1e293b',
                      backgroundColor: '#090d16',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={joinRoom}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Join Room
                  </button>
                  <button
                    onClick={createRoom}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1px solid #334155',
                      backgroundColor: 'transparent',
                      color: '#f8fafc',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Create
                  </button>
                </div>

                {/* Global Selected File Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#090d16',
                  borderRadius: '10px',
                  border: '1px dashed #334155'
                }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    {selectedFile ? `Selected: ${selectedFile.name}` : "No global file selected"}
                  </span>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelectedFile(file);
                    }}
                    style={{ fontSize: '12px', color: '#94a3b8' }}
                  />
                </div>
              </div>

              {/* Devices Grid / List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {roomDevices.length === 0 && (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '40px 20px',
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    border: '1px solid #1e293b',
                    color: '#64748b',
                    fontSize: '14px'
                  }}>
                    No devices connected to this room yet.
                  </div>
                )}

                {roomDevices.filter((device) => device.deviceId !== getDeviceID())
                  .map((device) => {
                    const isCurrentDevice = device.deviceId === getDeviceID();
                    const isConnected = roomPeerStatus[device.deviceId];

                    return (
                      <div
                        key={device.deviceId}
                        style={{
                          padding: '20px',
                          backgroundColor: '#0f172a',
                          borderRadius: '16px',
                          border: isConnected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid #1e293b',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                          boxShadow: isConnected ? '0 0 15px rgba(56, 189, 248, 0.05)' : 'none'
                        }}
                      >
                        {/* Device Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                              <DeviceIcon
                                deviceType={
                                  remoteDeviceInfo[device.deviceId]?.deviceType
                                  ?? "unknown"
                                }
                                size={30}
                              />

                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: device.online ? '#10b981' : '#f43f5e'
                              }} />
                              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f8fafc' }}>
                                {device.deviceName}
                              </h3>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                              {device.isHost && (
                                <span style={{ fontSize: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                  HOST
                                </span>
                              )}
                              {isCurrentDevice && (
                                <span style={{ fontSize: '10px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                  YOU
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Connection State / Button */}
                          {!isCurrentDevice && device.online && (
                            isConnected ? (
                              <button
                                onClick={() => disconnectFromRoomDevice(device.deviceId)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(244, 63, 94, 0.3)',
                                  backgroundColor: 'rgba(244, 63, 94, 0.1)',
                                  color: '#f43f5e',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => connectToRoomDevice(device)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  backgroundColor: '#2563eb',
                                  color: 'white',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                Connect
                              </button>
                            )
                          )}
                        </div>

                        {/* Card Actions (Text & Send File) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                          <input
                            placeholder={`Message to ${device.deviceName}...`}
                            value={deviceMessages?.[device.deviceId] || ''}
                            onFocus={() => {
                              if (!isCurrentDevice && device.online) {
                                const channel =
                                  roomDataChannels.current.get(device.deviceId);

                                if (channel?.readyState === "open") {
                                  resetRoomPeerTimer(device.deviceId);
                                }

                                ensureRoomConnection(device);
                              }
                            }}
                            onChange={(e) => {
                              const value = e.target.value;

                              setDeviceMessages((prev) => ({
                                ...prev,
                                [device.deviceId]: value,
                              }));
                            }}


                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const text = deviceMessages?.[device.deviceId];
                                if (text && text.trim()) {
                                  // Send the message
                                  sendRoomMessage(device, text);

                                  // Clear the input for this specific device
                                  setDeviceMessages((prev) => ({
                                    ...prev,
                                    [device.deviceId]: "",
                                  }));
                                }
                              }
                            }}


                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid #1e293b',
                              backgroundColor: '#090d16',
                              color: '#f8fafc',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />

                          {!isCurrentDevice && device.online && isConnected && (
                            <button
                              onClick={() => {
                                if (!selectedFile) {
                                  console.log("No file selected");
                                  return;
                                }
                                sendFileToRoomDevice(device.deviceId, selectedFile);
                              }}
                              style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: selectedFile ? '#059669' : '#1e293b',
                                color: selectedFile ? '#ffffff' : '#64748b',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: selectedFile ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s'
                              }}
                            >
                              Send Selected File
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Room Messages */}
              <div
                style={{
                  padding: "20px",
                  backgroundColor: "#0f172a",
                  borderRadius: "16px",
                  border: "1px solid #1e293b",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: "14px",
                    color: "#f8fafc",
                  }}
                >
                  Room Messages
                </h3>

                {receivedMessages.length === 0 ? (
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "13px",
                    }}
                  >
                    No messages yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {receivedMessages.map((msg, index) => (
                      <div
                        key={index}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "#090d16",
                          borderRadius: "8px",
                          color: "#cbd5e1",
                          fontSize: "13px",
                        }}
                      >
                        {msg}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* P2P Workspace (Blank as requested) */}
          {activeTab === 'p2p' && (
            <div style={{
              minHeight: '260px',
              backgroundColor: '#0f172a',
              borderRadius: '16px',
              border: '1px solid #1e293b'
            }}>
              {/* Blank P2P Div Container */}
            </div>
          )}


        </div>
      </main>

    </div>
  );

}