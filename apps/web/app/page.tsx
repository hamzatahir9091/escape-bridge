"use client";

import { useEffect, useRef, useState } from "react";

import { MessageType } from "@bridge/shared/src/protocol";

export default function Home() {
  const socket = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  const connect = () => {

    // console.log("WS URL =", process.env.NEXT_PUBLIC_WS_URL);
    socket.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    socket.current.onopen = () => {
      setConnected(true);
    };

    // when socket receive message do this
    socket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case MessageType.CLIENT_ID:
          console.log("My Client ID:", data.payload.clientId);
          break;

        case MessageType.SESSION_CREATED:
          console.log("Session Code:", data.payload.code);
          break;

        default:
          console.log("Unknown message:", data.type);
      }

      setMessages((prev) => [...prev, JSON.stringify(data)]);
    };


    // when soxket closes dothis
    socket.current.onclose = () => {
      console.log("Disconnected");
      setConnected(false);
    };
  };

  const sendMessage = () => {
    console.log("Button clicked");

    console.log(socket.current);

    console.log(message);

    if (!socket.current) {
      console.log("Socket doesn't exist");
      return;
    }

    console.log("Sending...");

    socket.current.send(message);

    setMessages((prev) => [...prev, `You: ${message}`]);

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


  return (
    <main style={{ padding: 40 }}>
      <h1>Bridge v0</h1>

      <button onClick={connect} disabled={connected}>
        {connected ? "Connected" : "Connect"}
      </button>

      <button onClick={createSession}>Create session</button>


      <br />
      <br />

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type..."
      />

      <button onClick={sendMessage}>Send</button>

      <hr />

      {messages.map((msg, index) => (
        <p key={index}>{msg}</p>
      ))}
    </main>
  );
}