"use client";

import { useEffect, useRef, useState } from "react";

import { MessageType } from "@bridge/shared";

// WEBRTC  imports
import { addIceCandidate, createAnswer, createDataChannel, createOffer, createPeerConnection, sendFile, setRemoteAnswer, setRemoteOffer } from "../lib/webrtc";
import { getDeviceID } from "../lib/device";

export default function Home() {
  const socket = useRef<WebSocket | null>(null);
  const peerREF = useRef<RTCPeerConnection | null>(null)
  const myRole = useRef<"HOST" | "GUEST" | null>(null);
  const peerId = useRef<string | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  const roomPeers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const roomDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());

  const incomingFile = useRef<{
    transferId: string;
    data: ArrayBuffer[];
    name: string;
    size: number;
    mimeType: string;
    totalChunks: number;
    chunkSize: number;
    receivedChunks: number;
    startTime: number;
  } | null>(null);

  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");                                 // state for current message
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);     // state for storing chat messages
  const [dataChannelOpen, setDataChannelOpen] = useState(false);              // state for kkeping track of connection
  const [sessionCode, setSessionCode] = useState("");                         // usestate for storing the code from next browser
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);                // state to store the ice candidates if the offer-answer cyclis still in process
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


  useEffect(() => {
    console.log("App started , connection made!!!!!");
    connect()
  }, []);

  // WHOLE IMPLEMENTATION IS BELOW

  const connect = () => {

    // console.log("WS URL =", process.env.NEXT_PUBLIC_WS_URL);
    socket.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);


    socket.current.onopen = () => {
      setConnected(true);

      const deviceId = getDeviceID();

      socket.current!.send(
        JSON.stringify({
          type: MessageType.DEVICE_REGISTER,
          payload: {
            deviceId,
            deviceName: "My Device",
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
                  setReceivedMessages((prev) => [...prev, message]);
                }
                if (message instanceof ArrayBuffer) {
                  // handleIncomingFile(message);
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
                    incomingFile.current = {
                      transferId: data.payload.transferId,
                      data: [],
                      name: data.payload.name,
                      size: data.payload.size,
                      mimeType: data.payload.mimeType,
                      totalChunks: data.payload.totalChunks,
                      chunkSize: data.payload.chunkSize,
                      receivedChunks: 0,
                      startTime: performance.now(),
                    };
                    console.log(
                      `📥 Receiving ${data.name}`
                    );
                    return;
                  }

                  if (data.type === "FILE_END") {

                    const transfer = incomingFile.current

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

                    incomingFile.current = null;



                    setReceivedMessages((prev) => [
                      ...prev,
                      `📥 ${transfer.name} received in ${seconds}s`,
                    ]);

                    return;
                  }

                  // Normal text message

                  setReceivedMessages((prev) => [
                    ...prev,
                    event.data,
                  ]);

                  return;
                }

                if (event.data instanceof ArrayBuffer) {
                  const transfer = incomingFile.current;

                  if (!transfer) {
                    console.error(
                      "Received chunk without FILE_START"
                    );
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
          setRoomCode(data.payload.code);
          setRoomDevices(data.payload.devices);
          break;
        }

        case MessageType.ROOM_DEVICES_UPDATED: {
          console.log("Room devices updated");

          setRoomDevices(data.payload.devices);

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
            };

            channel.onclose = () => {
              console.log(
                `🔴 Room DataChannel CLOSED → ${senderDeviceId}`
              );
            };

            channel.binaryType = "arraybuffer";

            channel.onmessage = handleIncomingFileMessage;
          };

          await setRemoteOffer(
            peer,
            data.payload.offer
          );

          console.log(
            `✅ Room OFFER applied from ${senderDeviceId}`
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
          const deviceId = data.payload.senderDeviceId;

          const peer = roomPeers.current.get(deviceId);

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

          break;
        }

        case MessageType.ROOM_ICE_CANDIDATE: {
          const senderDeviceId = data.payload.senderDeviceId;

          const peer = roomPeers.current.get(senderDeviceId);

          if (!peer) {
            console.log(
              "Room peer not found for ICE candidate:",
              senderDeviceId
            );
            break;
          }

          await addIceCandidate(
            peer,
            data.payload.candidate
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

    dataChannel.current.send(message);

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
    if (!roomCode) {
      console.log("No room code");
      return;
    }

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

    channel.onopen = () => {
      console.log(
        `🟢 Room DataChannel OPEN → ${device.deviceName}`
      );
    };

    channel.onclose = () => {
      console.log(
        `🔴 Room DataChannel CLOSED → ${device.deviceName}`
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


  const disconnectFromRoomDevice = (
    deviceId: string
  ) => {
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

    setRoomPeerStatus((prev) => {
      const updated = { ...prev };
      delete updated[deviceId];
      return updated;
    });

    console.log(
      `🔴 Disconnected from room device: ${deviceId}`
    );
  };

  const sendFileToRoomDevice = async (
    deviceId: string,
    file: File
  ) => {
    const channel = roomDataChannels.current.get(deviceId);

    if (!channel) {
      console.log("No DataChannel for this device");
      return;
    }

    if (channel.readyState !== "open") {
      console.log("Room DataChannel isn't open");
      return;
    }

    try {
      await sendFile(channel, file);

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

  const handleIncomingFileMessage = (
    event: MessageEvent
  ) => {
    if (typeof event.data === "string") {
      const data = JSON.parse(event.data);

      if (data.type === "FILE_START") {
        incomingFile.current = {
          transferId: data.payload.transferId,
          data: [],
          name: data.payload.name,
          size: data.payload.size,
          mimeType: data.payload.mimeType,
          totalChunks: data.payload.totalChunks,
          chunkSize: data.payload.chunkSize,
          receivedChunks: 0,
          startTime: performance.now(),
        };

        console.log(
          `📥 Receiving ${data.payload.name}`
        );

        return;
      }

      if (data.type === "FILE_END") {
        const transfer = incomingFile.current;

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
          { type: transfer.mimeType }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

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

        incomingFile.current = null;

        return;
      }

      return;
    }

    if (event.data instanceof ArrayBuffer) {
      const transfer = incomingFile.current;

      if (!transfer) {
        console.error(
          "Received chunk without FILE_START"
        );
        return;
      }

      transfer.data.push(event.data);
      transfer.receivedChunks++;

      console.log(
        `📥 Chunk ${transfer.receivedChunks}/${transfer.totalChunks}`
      );
    }
  };


  // return (
  //   <main style={{
  //     maxWidth: '600px',
  //     margin: '40px auto',
  //     fontFamily: 'system-ui, sans-serif',
  //     color: '#333',
  //     backgroundColor: '#a49c9c',
  //     padding: '30px',
  //     borderRadius: '16px',
  //     boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
  //   }}>
  //     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
  //       <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>Bridge v0</h1>
  //       <div style={{
  //         padding: '6px 12px',
  //         borderRadius: '20px',
  //         fontSize: '12px',
  //         fontWeight: '600',
  //         backgroundColor: dataChannelOpen ? '#e6fffa' : '#fff5f5',
  //         color: dataChannelOpen ? '#2c7a7b' : '#c53030',
  //         border: `1px solid ${dataChannelOpen ? '#b2f5ea' : '#feb2b2'}`
  //       }}>
  //         {dataChannelOpen ? "🟢 P2P Connected" : "🔴 P2P Disconnected"}
  //       </div>
  //     </div>


  //     {/* Section: Session Management */}
  //     <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eee' }}>
  //       <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#666', textTransform: 'uppercase' }}>Step 2: Create or Join Session</label>
  //       <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
  //         <button
  //           onClick={createSession}
  //           style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', fontWeight: '600', cursor: 'pointer' }}
  //         >
  //           Create Session
  //         </button>
  //       </div>
  //       <div style={{ display: 'flex', gap: '8px' }}>
  //         <input
  //           value={sessionCode}
  //           onChange={(e) => setSessionCode(e.target.value)}
  //           placeholder="Enter Session Code"
  //           style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
  //         />
  //         <button
  //           onClick={joinSession}
  //           style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#3182ce', color: 'white', fontWeight: '600', cursor: 'pointer' }}
  //         >
  //           Join Session
  //         </button>
  //       </div>
  //     </div>

  //     {/* Section: P2P Transfer */}
  //     <div style={{
  //       marginBottom: '24px',
  //       padding: '20px',
  //       backgroundColor: '#fff',
  //       borderRadius: '12px',
  //       border: '1px solid #eee',
  //     }}>
  //       <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#666', textTransform: 'uppercase' }}>Step 3: Direct Transfer</label>

  //       {/* File Input Group */}
  //       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
  //         <input
  //           type="file"
  //           onChange={(e) => {
  //             const file = e.target.files?.[0] ?? null;
  //             setSelectedFile(file);
  //           }}
  //           style={{ fontSize: '14px' }}
  //         />
  //         <button
  //           onClick={async () => {
  //             if (!selectedFile) {
  //               console.log("No file selected");
  //               return;
  //             }
  //             if (!dataChannel.current) {
  //               console.log("DataChannel doesn't exist");
  //               return;
  //             }
  //             try {
  //               await sendFile(dataChannel.current, selectedFile);
  //               console.log("File transfer complete");
  //             } catch (error) {
  //               console.error("File transfer failed:", error);
  //             }
  //           }}
  //           disabled={!dataChannelOpen || !selectedFile}
  //           style={{
  //             padding: '12px',
  //             borderRadius: '8px',
  //             border: 'none',
  //             backgroundColor: '#38a169',
  //             color: 'white',
  //             fontWeight: '600',
  //             cursor: (!dataChannelOpen || !selectedFile) ? 'not-allowed' : 'pointer'
  //           }}
  //         >
  //           Send File Directly
  //         </button>
  //       </div>

  //       {/* Message Input Group */}
  //       <div style={{ display: 'flex', gap: '8px' }}>
  //         <input
  //           value={message}
  //           onChange={(e) => setMessage(e.target.value)}
  //           placeholder="Type a message..."
  //           style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
  //         />
  //         <button
  //           onClick={sendDataChannelMessage}
  //           disabled={!dataChannelOpen}
  //           style={{
  //             flex: 1,
  //             padding: '10px',
  //             borderRadius: '8px',
  //             border: 'none',
  //             backgroundColor: '#805ad5',
  //             color: 'white',
  //             fontWeight: '600',
  //             cursor: !dataChannelOpen ? 'not-allowed' : 'pointer'
  //           }}
  //         >
  //           Send P2P
  //         </button>
  //       </div>
  //     </div>

  //     {/* Section: Chat Log */}
  //     <div style={{ marginTop: '30px' }}>
  //       <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#666', textTransform: 'uppercase' }}>Activity Log</label>
  //       <div style={{
  //         height: '150px',
  //         overflowY: 'auto',
  //         backgroundColor: '#f1f5f9',
  //         padding: '15px',
  //         borderRadius: '12px',
  //         fontSize: '14px',
  //         lineHeight: '1.6',
  //         border: '1px solid #e2e8f0'
  //       }}>
  //         {receivedMessages.length === 0 && <span style={{ color: '#94a3b8' }}>No activity yet...</span>}
  //         {receivedMessages.map((msg, index) => (
  //           <div key={index} style={{
  //             marginBottom: '6px',
  //             paddingBottom: '6px',
  //             borderBottom: '1px solid #e2e8f0',
  //             color: msg.startsWith('You:') ? '#4a5568' : '#2d3748',
  //             fontWeight: msg.startsWith('You:') ? '400' : '600'
  //           }}>
  //             {msg}
  //           </div>
  //         ))}
  //       </div>
  //     </div>

  //     <hr />

  //     <h2>Device Room</h2>

  //     <button onClick={createRoom}>
  //       Create Room
  //     </button>

  //     <br />
  //     <br />

  //     <input
  //       value={roomCode}
  //       onChange={(e) => setRoomCode(e.target.value)}
  //       placeholder="Room Code"
  //     />

  //     <button onClick={joinRoom}>
  //       Join Room
  //     </button>

  //     <br />
  //     <br />
  //     {/* {roomDevices.map((device) => (
  //       <p key={device.deviceId}>
  //         {device.online ? "🟢" : "🔴"}{" "}
  //         {device.deviceName}

  //         {device.isHost && " 👑 HOST"}

  //         {device.online &&
  //           roomPeerStatus[device.deviceId] && (
  //             <> — 🔗 P2P Connected</>
  //           )}
  //       </p>
        
  //     ))} */}
  //     {roomDevices.map((device) => (
  //       <div key={device.deviceId}>
  //         <p>
  //           {device.online ? "🟢" : "🔴"}{" "}
  //           {device.deviceName}

  //           {device.isHost && " 👑 HOST"}
  //         </p>
  //         {device.deviceId !== getDeviceID() && device.online && (
  //           roomPeerStatus[device.deviceId] ? (
  //             <button
  //               onClick={() =>
  //                 disconnectFromRoomDevice(device.deviceId)
  //               }
  //             >
  //               Disconnect
  //             </button>
  //           ) : (
  //             <button
  //               onClick={() =>
  //                 connectToRoomDevice(device)
  //               }
  //             >
  //               Connect
  //             </button>
  //           )
  //         )}

  //         {device.deviceId !== getDeviceID() &&
  //           device.online &&
  //           roomPeerStatus[device.deviceId] && (
  //             <button
  //               onClick={() => {
  //                 if (!selectedFile) {
  //                   console.log("No file selected");
  //                   return;
  //                 }

  //                 sendFileToRoomDevice(
  //                   device.deviceId,
  //                   selectedFile
  //                 );
  //               }}
  //             >
  //               Send File
  //             </button>
  //           )}
  //       </div>


  //     ))}
  //   </main>
  // );

return (
    <main style={{
      maxWidth: '700px',
      margin: '40px auto',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      color: '#e2e8f0',
      backgroundColor: '#0f172a',
      padding: '40px',
      borderRadius: '24px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      border: '1px solid #1e293b'
    }}>
      {/* Header & Connection Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', letterSpacing: '-1px', color: '#f8fafc' }}>Bridge <span style={{ color: '#38bdf8' }}>v0</span></h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>Secure Peer-to-Peer Transfer</p>
        </div>
        <div style={{
          padding: '8px 16px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
          backgroundColor: dataChannelOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          color: dataChannelOpen ? '#10b981' : '#f43f5e',
          border: `1px solid ${dataChannelOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dataChannelOpen ? '#10b981' : '#f43f5e' }}></span>
          {dataChannelOpen ? "P2P Connected" : "P2P Disconnected"}
        </div>
      </div>

      {/* Section: Session Management */}
      <div style={{ marginBottom: '24px', padding: '24px', backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '16px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Session Management</label>
        
        <button
          onClick={createSession}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #334155', backgroundColor: 'transparent', color: '#f1f5f9', fontWeight: '600', cursor: 'pointer', marginBottom: '16px', transition: 'all 0.2s' }}
        >
          Create New Session
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            placeholder="Enter Session Code"
            style={{ flex: 2, padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', outline: 'none' }}
          />
          <button
            onClick={joinSession}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '600', cursor: 'pointer' }}
          >
            Join
          </button>
        </div>
      </div>

      {/* Section: P2P Transfer */}
      <div style={{ marginBottom: '24px', padding: '24px', backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '16px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Direct Transfer</label>

        {/* File Input Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ position: 'relative', border: '2px dashed #334155', borderRadius: '12px', padding: '20px', textAlign: 'center', backgroundColor: '#0f172a' }}>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
              style={{ fontSize: '14px', color: '#94a3b8', width: '100%' }}
            />
          </div>
          
          <button
            onClick={async () => {
              if (!selectedFile) return;
              if (!dataChannel.current) return;
              try {
                await sendFile(dataChannel.current, selectedFile);
              } catch (error) {
                console.error("File transfer failed:", error);
              }
            }}
            disabled={!dataChannelOpen || !selectedFile}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: (!dataChannelOpen || !selectedFile) ? '#1e293b' : '#059669',
              color: (!dataChannelOpen || !selectedFile) ? '#475569' : 'white',
              fontWeight: '600',
              cursor: (!dataChannelOpen || !selectedFile) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Send File Directly
          </button>
        </div>

        {/* Message Input Group */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type an encrypted message..."
            style={{ flex: 2, padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', outline: 'none' }}
          />
          <button
            onClick={sendDataChannelMessage}
            disabled={!dataChannelOpen}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: !dataChannelOpen ? '#1e293b' : '#8b5cf6',
              color: !dataChannelOpen ? '#475569' : 'white',
              fontWeight: '600',
              cursor: !dataChannelOpen ? 'not-allowed' : 'pointer'
            }}
          >
            Send P2P
          </button>
        </div>
      </div>

      {/* Section: Activity Log */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '12px', color: '#64748b', textTransform: 'uppercase' }}>Activity Log</label>
        <div style={{
          height: '160px',
          overflowY: 'auto',
          backgroundColor: '#020617',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '13px',
          lineHeight: '1.6',
          border: '1px solid #1e293b',
          fontFamily: '"Fira Code", monospace'
        }}>
          {receivedMessages.length === 0 && <span style={{ color: '#475569' }}>{">"} awaiting activity...</span>}
          {receivedMessages.map((msg, index) => (
            <div key={index} style={{
              marginBottom: '8px',
              paddingBottom: '8px',
              borderBottom: '1px solid #0f172a',
              color: msg.startsWith('You:') ? '#94a3b8' : '#38bdf8',
            }}>
              <span style={{ color: '#475569', marginRight: '8px' }}>[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
              {msg}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '40px 0' }} />

      {/* Device Room Section */}
      <div style={{ padding: '24px', backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>Device Room</h2>
          <button 
            onClick={createRoom}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            Create Room
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Room Code"
            style={{ flex: 2, padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', outline: 'none' }}
          />
          <button
            onClick={joinRoom}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '600', cursor: 'pointer' }}
          >
            Join Room
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {roomDevices.map((device) => (
            <div key={device.deviceId} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              backgroundColor: '#0f172a',
              borderRadius: '12px',
              border: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '10px' }}>{device.online ? "🟢" : "🔴"}</span>
                <span style={{ fontWeight: '600', color: '#f1f5f9' }}>{device.deviceName}</span>
                {device.isHost && <span style={{ fontSize: '10px', backgroundColor: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>HOST</span>}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {device.deviceId !== getDeviceID() && device.online && (
                  roomPeerStatus[device.deviceId] ? (
                    <>
                      <button
                        onClick={() => disconnectFromRoomDevice(device.deviceId)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #f43f5e', backgroundColor: 'transparent', color: '#f43f5e', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Disconnect
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedFile) return;
                          sendFileToRoomDevice(device.deviceId, selectedFile);
                        }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#059669', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Send File
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => connectToRoomDevice(device)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Connect
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}