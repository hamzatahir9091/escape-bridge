"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { MessageType } from "@bridge/shared";

// WEBRTC  imports
import { addIceCandidate, createAnswer, createDataChannel, createOffer, createPeerConnection, sendFile, setRemoteAnswer, setRemoteOffer } from "../lib/webrtc";
import { getDeviceID, hasDeviceID, getDeviceName, setDeviceNameInLocalstorage, } from "../lib/device";

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
import Intro from "../components/Intro";
import StrokeText from '../components/StrokeText';


import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import CodeInput from "../components/CodeInput";
import React from "react";


export default function Home() {
  const socket = useRef<WebSocket | null>(null);
  const peerREF = useRef<RTCPeerConnection | null>(null)
  const myRole = useRef<"HOST" | "GUEST" | null>(null);
  const peerId = useRef<string | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);                // state to store the ice candidates if the offer-answer cyclis still in process
  const roomPendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const joinButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const otpbuttonRef = useRef<HTMLButtonElement | null>(null);   // otp button ref

  // GSAP REFS
  const heroRef = useRef<HTMLDivElement>(null)
  const Container = useRef<HTMLDivElement>(null)
  const heroTL = useRef<gsap.core.Timeline | null>(null);
  const afterIntroTL = useRef<gsap.core.Timeline | null>(null);
  const roomJoinedTl = useRef<gsap.core.Timeline | null>(null);
  const RefreshTL = useRef<gsap.core.Timeline | null>(null);
  const introRef = useRef<HTMLDivElement>(null);


  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");                                 // state for current message
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);     // state for storing chat messages
  const [dataChannelOpen, setDataChannelOpen] = useState(false);              // state for kkeping track of connection
  const [sessionCode, setSessionCode] = useState("");                         // usestate for storing the code from next browser
  const [selectedFile, setSelectedFile] = useState<File | null>(null)         // state for storing the current file
  const [roomCode, setRoomCode] = useState<string>("")
  const [roomCodeCreated, setRoomCodeCreated] = useState<string>("")
  const [roomDevices, setRoomDevices] = useState<
    {
      deviceId: string;
      deviceName: string;
      online: boolean;
      isHost: boolean;
    }[]
  >([]);
  const [roomPeerStatus, setRoomPeerStatus] = useState<Record<string, boolean>>({});

  const [needsDeviceSetup, setNeedsDeviceSetup] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false)
  const [isSettled, setIsSettled] = useState(false); // To track if we've checked localStorage

  const [deviceName, setDeviceNameState] = useState("My Device");

  const [activeTab, setActiveTab] = useState('room');
  const [deviceMessages, setDeviceMessages] = useState<Record<string, string>>({});


  const [deviceInfo, setDeviceInfo] =
    useState<DeviceInfo | null>(null);

  const [remoteDeviceInfo, setRemoteDeviceInfo] =
    useState<Record<string, DeviceInfo>>({});

  useLayoutEffect(() => {
    console.log('use layout effect running ',)

    const info = getLocalDeviceInfo();

    setDeviceInfo(info);

    if (!hasDeviceID()) {
      console.log("🆕 First visit — device setup required");

      setDeviceNameState(info.deviceType);

      setNeedsDeviceSetup(true);
      setIsNewUser(true)
      setIsSettled(true);

      return;
    }
    setNeedsDeviceSetup(false);
    console.log('not first visit , setup is set false',)

    setIsSettled(true);
    console.log('is steeled is set to true',)

  }, [])


  // WHOLE IMPLEMENTATION IS BELOW

  const connect = () => {

    console.log('running the connect function',)
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
          break;

        case MessageType.SESSION_CREATED:
          console.log('SESSION_CREATED CASE RAN',)
          console.log("Session Code:", data.payload.code);
          break;

        case MessageType.SESSION_JOINED: {
          console.log('SESSION_JOINED CASE RAN',)
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
          console.log('OFFER CASE RAN',)

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
          console.log('ANSWER CASE RAN',)
          await setRemoteAnswer(
            peerREF.current!,
            data.payload.answer
          );

          console.log(data.payload.answer);

          processPendingCandidates();

          break;
        }

        case MessageType.ICE_CANDIDATE: {
          console.log('ICE_CANDIDATE CASE RAN',)

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
          console.log('ROOM_CREATED CASE RAN',)
          const code = data.payload.code;
          console.log("Room created:", code);
          setRoomCodeCreated(code)
          setRoomCode(code);
          break;
        }

        case MessageType.ROOM_JOINED: {
          console.log('ROOM_JOINED CASE RAN',)
          const code = data.payload.code;

          roomJoinedTl

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
          console.log("Room devices updated , CASE RAN");

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
          console.log('ROOM_OFFER CASE RAN',)
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
          console.log('ROOM_ANSWER CASE RAN',)
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
          console.log('ROOM-ICE-CANDIDATE CASE RAN',)
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
          // console.log("default csae message:", data.type);
        }
      }

    };


    // when soxket closes dothis
    socket.current.onclose = () => {
      console.log("socket disconnected from server Disconnected");
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
      console.log('rooomcode not entered , printed from JoinRoom function')
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
    setDeviceNameInLocalstorage(name);

    // This creates and saves the device ID for the first time
    getDeviceID();

    connect();
  };


  const resetStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };




  // // GSAP ANIMATIONS
  useGSAP(
    () => {

      console.log('we are inside gsap hook ',)
      if (!isSettled) {
        console.log('not sttled if returned',)
        return
      };
      console.log('we are inside settler',)


      // run this animation if we need device setup
      if (isNewUser) {

        if (!heroRef.current || !introRef.current) return

        heroTL.current = gsap.timeline({
          paused: true,
        });

        afterIntroTL.current = gsap.timeline({
          paused: true,
        });


        gsap.set(introRef.current, {
          y: 30,
          opacity: 0,
          pointerEvents: "auto"
          // scale: 0.95
        });

        heroTL.current.to(
          heroRef.current,
          {
            scale: 0.5,
            y: "-40vh",
            duration: 1,
            delay: 0.5,
            ease: "power2.inOut",
          })
          .to(introRef.current, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5
          }, ">-0.3")


        afterIntroTL.current.
          to(heroRef.current, {
            y: "-55vh",
            duration: 1
          })
          .to(introRef.current, {
            opacity: 0,
            duration: 0.5,
            pointerEvents: "none"
          }, "<")
          .set("#logo", {
            x: -100,
          })
          .set("#navTabs", {
            y: -100,
          })
          .set("#roomIntroText", {
            y: -30,
            scale: 0.95
          })
          .set("#roomSelectionBox", {
            y: 50,
            scale: 0.95
          })
          .set("#roomWorkSpace", {
            pointerEvents: "auto"
          })
          .to("#logo", {
            opacity: 1,
            duration: 0.5,
            x: 0
          }, "<")
          .to("#navTabs", {
            opacity: 1,
            y: 0,
            duration: 0.5,
            onComplete: () => {
              setNeedsDeviceSetup(false)
            }
          }, "<")
          .to("#roomIntroText", {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.5,
          }, "<")
          .to("#roomSelectionBox", {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
          }, ">")
          .to("#roomSelectionText-1", {
            opacity: 1,
            // y: 0,
            // scale: 1,
            duration: 0.5,
          }, ">")

      }

      // run tis animation when we do no need device setup
      // if (!isNewUser) {

      //   console.log('refresh animation working',)

      //   RefreshTL.current = gsap.timeline();

      //   RefreshTL.current
      //     .set("#logo", {
      //       x: -100,
      //     })
      //     .set("#navTabs", {
      //       y: -100,
      //     })
      //     .to("#logo", {
      //       opacity: 1,
      //       duration: 0.5,
      //       x: 0
      //     }, "<")
      //     .to("#navTabs", {
      //       opacity: 1,
      //       y: 0,
      //       duration: 0.5
      //     }, "<")
      // }

    },
    {
      scope: Container,
      dependencies: [isSettled, isNewUser],
    }
  );


  // this gsap runs the animation when first room is joined
  useGSAP(() => {
    roomJoinedTl.current = gsap.timeline({
      paused: true
    })

    console.log('we are inside second ', )
    roomJoinedTl.current
      .to("#roomSelectionBox", {
        height: "100%",
        width: "100%",
        duration: 0.5
      })


  })

  const createRoomButtonAnimation = () => {
    const tl = gsap.timeline();

    tl
      .set("#roomSelectionText-2", {
        scale: 0.7
      })
      .to("#roomSelectionText-1", {
        yPercent: -100,
        opacity: 0,
        scale: 0.7,
        duration: 0.8,
        ease: "power1.out",
      })
      .to(
        "#roomSelectionText-2",
        {
          yPercent: -100,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: "power1.out",
        },
        "<"
      );
  }

  const handleStrokeComplete = () => {
    heroTL.current?.play();
  };

  const handleIntroSetupDone = () => {
    afterIntroTL.current?.play();
  }

  // this function fires when inside codeInput comp all six digs are typed
  const handleCodeComplete = (code: string) => {
    setRoomCode(code)
  };


  return (

    <div ref={Container} className="relative bg-[#010610] w-[100vw] h-[100vh] flex flex-  items-center">

      <button className="absolute z-10000 top-0 right-0 bg-amber-600 "
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

      {/* hero text */}

      <div ref={heroRef} className="absolute inset-0 neon-font " >
        <StrokeText
          className="tile absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-2/3 "
          text="Escape-Bridge"
          strokeColor="#A78BFA"
          fillColor="#F8FAFC"
          strokeWidth={1}
          drawDuration={1}
          fillDelay={0}
          stagger={0.05}
          ease="power2.out"
          trigger="mount"
          fillMode="wipe"
          fontSize={130}
          fontWeight={800}
          letterSpacing={-4}
          reverse={false}
          onComplete={handleStrokeComplete}

        /></div>


      {/* intro para */}
      <div ref={introRef} className="absolute  h-full w-full flex items-center justify-center opacity-0 pointer-events-none">

        <Intro
          deviceName={deviceName}
          setDeviceNameState={setDeviceNameState}
          handleDeviceSetup={handleDeviceSetup}
          handleIntroSetupDone={handleIntroSetupDone}
        />
      </div>



      {/* Main site things */}
      <div className="w-full h-full flex flex-col  ">

        {/* ROP BAR */}
        <div className=" w-full h-1/10 grid grid-cols-3  ">

          {/* side logo */}
          <h1 id="logo" className="neon-font font-extrabold text-3xl tracking-wide justify-self-start self-center h-fit ml-[2vw] opacity-0">
            Escape-Bridge
          </h1>

          {/* Top Navigation Tabs */}
          <div id="navTabs" className="  justify-self-center self-center opacity-0">
            <div className="flex rounded-[14px] border border-slate-800 bg-slate-900 p-1 h-18">
              <button
                onClick={() => setActiveTab('room')}
                className={`cursor-pointer rounded-[10px] border-none px-7 py-2.5text-sm font-semibold transition-all duration-200 ease-in-out${activeTab === 'room'
                  ? 'bg-slate-800 text-sky-400 shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
                  : 'bg-transparent text-slate-500 shadow-none'
                  }`}>
                Room
              </button>

              <button
                onClick={() => setActiveTab('p2p')}
                className={`cursor-pointer rounded-[10px] border-none px-7 py-2.5        text-sm font-semibold transition-all duration-200 ease-in-out        ${activeTab === 'p2p'
                  ? 'bg-slate-800 text-sky-400 shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
                  : 'bg-transparent text-slate-500 shadow-none'
                  }`}>
                P2P
              </button>
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION */}
        <div className=" mx-auto m-10  w-[90vw] h-[90%] bg font-['Inter',system-ui,-apple-system,sans-serif] text-slate-200 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] ">

          {/* Main Workspace */}
          <div className="h-full">
            {activeTab === 'room' && (
              <div id="roomWorkSpace" className="flex flex-col h-full justify-center items-center gap-6 pointer-events-none">

                <span id="roomIntroText" className="opacity-0 h-1/6 flex justify-center items-center text-slate-300 text-3xl">If u want one time setup and seemeless connectivity , u are at right place </span>

                <div id="roomSelectionBox" className="opacity-0 w-4/5 h-5/6  border-4 rounded-t-4xl    shadow-2xl [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">

                  {/* this is the create and join room card  */}
                  <div className="grid grid-cols-2 gap-5 p-7">

                    {/* CREATE ROOM */}
                    <div className="relative overflow-hidden rounded-[20px] border border-[rgba(140,180,220,0.12)] bg-gradient-to-b from-[#101a26] to-[#13202f] p-7">

                      {/* subtle glow */}
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(320px_160px_at_15%_-10%,rgba(62,232,255,0.08),transparent_70%)]" />

                      <div className="relative">

                        {/* label */}
                        <div className="mb-[18px] flex items-center gap-[9px] font-mono text-[11px] uppercase tracking-[0.14em] text-[#5c6c82]">
                          <span className="h-[6px] w-[6px] rounded-full bg-[#3ee8ff] shadow-[0_0_6px_#3ee8ff]" />
                          New session
                        </div>

                        {/* heading */}
                        <h2 className="mb-2 font-['Sora'] text-[19px] font-semibold text-[#eaf2fb]">
                          Create a room
                        </h2>

                        {/* description */}
                        <p className="mb-6 text-[13.5px] leading-[1.55] text-[#93a5bd]">
                          Generates a one-time 6-digit code. Share it with any device you
                          want to bridge into this room.
                        </p>

                        {/* create button */}
                        <button onClick={() => {
                          createRoom()
                          createRoomButtonAnimation()
                        }} className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#3ee8ff] via-[#7fd8ff] to-[#4f8cff] px-5 py-[13px] text-[14px] font-semibold text-[#02141c] shadow-[0_8px_26px_-8px_rgba(62,232,255,0.55)] transition hover:shadow-[0_10px_32px_-6px_rgba(62,232,255,0.7)] active:scale-[0.98]">

                          <span className="text-[20px] leading-none">+</span>

                          Create room
                        </button>

                        {/* generated code */}
                        <div className="mt-[22px]">

                          <div className="mb-4 flex flex-wrap gap-2">

                            {[0, 1, 2, 3, 4, 5].map((index) => (
                              <div
                                key={index}
                                className={`min-w-[54px] min-h-[64px] rounded-[10px] border border-[rgba(140,200,255,0.24)] bg-[rgba(62,232,255,0.06)] px-[14px] py-[10px] text-center font-mono text-[30px] font-semibold tracking-[0.02em] text-[#eaf2fb] [text-shadow:0_0_20px_rgba(62,232,255,0.35)] ${index === 3 ? "ml-1" : ""
                                  }`}
                              >
                                {roomCodeCreated?.[index] || ""}
                              </div>
                            ))}

                          </div>

                          {/* copy/share */}
                          <div className="flex gap-[10px]">

                            <button className="flex w-auto items-center justify-center gap-2 rounded-[9px] border border-[rgba(140,180,220,0.12)] bg-[rgba(255,255,255,0.03)] px-[14px] py-[9px] text-[12.5px] font-semibold text-[#eaf2fb] transition hover:border-[rgba(140,200,255,0.24)] hover:bg-[rgba(255,255,255,0.06)]">
                              Copy code
                            </button>

                            <button className="flex w-auto items-center justify-center gap-2 rounded-[9px] border border-[rgba(140,180,220,0.12)] bg-[rgba(255,255,255,0.03)] px-[14px] py-[9px] text-[12.5px] font-semibold text-[#eaf2fb] transition hover:border-[rgba(140,200,255,0.24)] hover:bg-[rgba(255,255,255,0.06)]">
                              Share
                            </button>

                          </div>

                        </div>

                      </div>
                    </div>


                    {/* JOIN ROOM */}
                    <div className="relative overflow-hidden rounded-[20px] border border-[rgba(140,180,220,0.12)] bg-gradient-to-b from-[#101a26] to-[#13202f] p-7">

                      {/* subtle glow */}
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(320px_160px_at_15%_-10%,rgba(62,232,255,0.08),transparent_70%)]" />

                      <div className="relative">

                        {/* label */}
                        <div className="mb-[18px] flex items-center gap-[9px] font-mono text-[11px] uppercase tracking-[0.14em] text-[#5c6c82]">
                          <span className="h-[6px] w-[6px] rounded-full bg-[#3ee8ff] shadow-[0_0_6px_#3ee8ff]" />
                          Join session
                        </div>

                        {/* heading */}
                        <h2 className="mb-2 font-['Sora'] text-[19px] font-semibold text-[#eaf2fb]">
                          Join a room
                        </h2>

                        {/* description */}
                        <p className="mb-6 text-[13.5px] leading-[1.55] text-[#93a5bd]">
                          Enter the 6-digit code shown on the other device to bridge into
                          their room.
                        </p>

                        {/* OTP */}
                        <div className="mb-5 flex gap-2">
                          <CodeInput onComplete={handleCodeComplete}
                          // nextFocusRef={joinButtonRef} 
                          />

                        </div>

                        {/* join */}
                        <button ref={joinButtonRef}
                          onClick={joinRoom}
                          className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#3ee8ff] via-[#7fd8ff] to-[#4f8cff] px-5 py-[13px] text-[14px] font-semibold text-[#02141c] shadow-[0_8px_26px_-8px_rgba(62,232,255,0.55)] transition hover:shadow-[0_10px_32px_-6px_rgba(62,232,255,0.7)] active:scale-[0.98]">

                          <span className="text-[18px]">→</span>

                          Join room
                        </button>

                        {/* helper */}
                        <p className="mt-3 text-[12.5px] text-[#5c6c82]">
                          Codes are 6 digits and expire when the room closes.
                        </p>

                      </div>
                    </div>

                  </div>

                  <div className="mt-16">
                    <span id="roomSelectionText-1" className="opacity-0 h-fit bg-gray-700 flex justify-center items-center text-slate-300 text-3xl" >Just create a room, copy the code and paste it on the other device</span>
                    <span id="roomSelectionText-2" className="opacity-0 h-fit flex justify-center items-center text-slate-300 text-3xl" >Congrats!! U just created a room <br />Now paste the code on other device and witness the happening</span>
                  </div>
                </div>


              </div>
            )}

            {/* P2P Workspace (Blank as requested) */}
            {activeTab === 'p2p' && (
              <div className="min-h-[260px] rounded-2xl border border-slate-800 bg-slate-900">
                {/* Blank P2P Div Container */}
              </div>
            )}
          </div>
        </div>

      </div>


    </div>
  );

}