"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const socket = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  const connect = () => {

      console.log("WS URL =", process.env.NEXT_PUBLIC_WS_URL);
    socket.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    socket.current.onopen = () => {
      console.log("Connected");
      console.log(socket.current?.readyState);
      setConnected(true);
    };

    socket.current.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

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


  return (
    <main style={{ padding: 40 }}>
      <h1>Bridge v0</h1>

      <button onClick={connect} disabled={connected}>
        {connected ? "Connected" : "Connect"}
      </button>

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