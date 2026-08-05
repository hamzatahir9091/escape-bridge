import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid"
import { MessageType, ClientMessage } from "@bridge/shared";
import { clients, sessions } from "./store/state";
import { handleCreateSession, handleJoinSession } from "./handlers/session";

const app = express();

const PORT = Number(process.env.PORT) || 3001; // Railway will provide the PORT


const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// creating the web socket server
const wss = new WebSocketServer({ server })

// This server is the HTTP server that Express is using.
// When you do:
// new WebSocketServer({ server });
// you're telling the WebSocket library:
// "Attach yourself to this existing HTTP server."
// Now both HTTP requests and WebSocket connections use the same port (3001).


wss.on("connection", (socket: WebSocket) => {

    const clientId = uuidv4()
    console.log(`Client connected: ${clientId}`);
    clients.set(clientId, socket);


    // now sending client id back to browser by using socket.send
    socket.send(JSON.stringify({
        type: MessageType.CLIENT_ID,
        payload: {
            clientId,
        },
    }))


    // now creating a incoming message handler 
    socket.on("message", (message) => {
        const data = JSON.parse(message.toString()) as ClientMessage;

        switch (data.type) {
            case MessageType.CREATE_SESSION: {
                handleCreateSession(socket, clientId);
                break;
            }

            //  NOW XREATING A LISTNER FOR THE JOIN-SESSION MESSAGE FROM BROWSER
            case MessageType.JOIN_SESSION: {
                handleJoinSession(socket, clientId, data);
                break;
            }
        }
    })

    socket.on("close", () => {
        console.log("❌ Client disconnected");
        clients.delete(clientId);
    });
}
    //  This line means
    // "When THIS client sends a message..."
)
// .on() is used to listen for an event.
// General syntax:
// object.on(eventName, callbackFunction)