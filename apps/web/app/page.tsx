"use client";

import { useEffect, useRef, useState } from "react";

import { MessageType } from "@bridge/shared";

// WEBRTC  imports
import { addIceCandidate, createAnswer, createDataChannel, createOffer, createPeerConnection, setRemoteAnswer, setRemoteOffer } from "../lib/webrtc";

export default function Home() {
  const socket = useRef<WebSocket | null>(null);
  const peerREF = useRef<RTCPeerConnection | null>(null)
  const myRole = useRef<"HOST" | "GUEST" | null>(null);
  const peerId = useRef<string | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");                                 // state for current message
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);     // state for storing chat messages
  const [dataChannelOpen, setDataChannelOpen] = useState(false);              // state for kkeping track of connection
  const [sessionCode, setSessionCode] = useState("");                         // usestate for storing the code from next browser
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);                // state to store the ice candidates if the offer-answer cyclis still in process

  const connect = () => {

    // console.log("WS URL =", process.env.NEXT_PUBLIC_WS_URL);
    socket.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    socket.current.onopen = () => {
      setConnected(true);
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
                setReceivedMessages((prev) => [...prev, message]);
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
              channel.onmessage = (e) => {
                setReceivedMessages((prev) => [...prev, e.data]);
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

  return (
    <main style={{ padding: 40 }}>
      <h1>Bridge v0</h1>
      <p>
        DataChannel:{" "}
        {dataChannelOpen ? "🟢 Connected" : "🔴 Not connected"}
      </p>

      <button onClick={connect} disabled={connected}>
        {connected ? "Connected" : "Connect"}
      </button>
      <br />
      <button onClick={createSession}>Create session</button>

      <br />
      <br />

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type..."
      />

      <button
        onClick={sendDataChannelMessage}
        disabled={!dataChannelOpen}
      >
        Send P2P
      </button>

      <br />

      <input value={sessionCode}
        onChange={(e) => setSessionCode(e.target.value)}
        placeholder="Session Code"
      />

      <button onClick={joinSession}>
        Join Session
      </button>

      <hr />

      <div>
        {receivedMessages.map((msg, index) => (
          <p key={index}>{msg}</p>
        ))}
      </div>
    </main>
  );
}