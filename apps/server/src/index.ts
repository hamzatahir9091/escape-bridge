import express from "express";
import { WebSocket, WebSocketServer } from "ws";

const app = express();

const PORT = 3001;


const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
})

// creating the web socket server
const wss = new WebSocketServer({ server })

// This server is the HTTP server that Express is using.
// When you do:
// new WebSocketServer({ server });
// you're telling the WebSocket library:
// "Attach yourself to this existing HTTP server."
// Now both HTTP requests and WebSocket connections use the same port (3001).

const clients = new Set<WebSocket>()

wss.on("connection", (socket) => {

    console.log("client connected")

    clients.add(socket);

    socket.on("message", (message) => {
        console.log("Received:", message.toString());

        for (const client of clients) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        }
    });

    socket.on("close", () => {
        console.log("❌ Client disconnected");
        clients.delete(socket);
    });
}

    //  This line means
    // "When THIS client sends a message..."
)

// .on() is used to listen for an event.
// General syntax:
// object.on(eventName, callbackFunction)