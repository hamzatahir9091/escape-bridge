import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid"

import {
    MessageType,
    type Session,
    ClientMessage
} from "@bridge/shared";


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

const clients = new Map<string, WebSocket>()

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
                const sessionCode = generateSessionCode()

                sessions.set(sessionCode, { host: clientId, })

                socket.send(
                    JSON.stringify({
                        type: MessageType.SESSION_CREATED,
                        payload: {
                            code: sessionCode,
                        },
                    })
                );
                console.log(`Session ${sessionCode} created by ${clientId}`);
                break;
            }

            //  NOW XREATING A LISTNER FOR THE JOIN-SESSION MESSAGE FROM BROWSER
            case MessageType.JOIN_SESSION: {

                const code = data.payload.code;
                const session = sessions.get(code);

                if (!session) {
                    console.log("Session not found");
                    break;
                }
                if (session.guest) {
                    console.log("Session already full");
                    break;
                }

                // now even after that check we know session exists and guest is empty so
                session.guest = clientId;  // setting the guest id in the session

                // now we need to find the socket of host and guest
                const hostSocket = clients.get(session.host)
                const guestSocket = socket;

                // now we notifing the host and guest that session is joined
                hostSocket?.send(
                    JSON.stringify({
                        type: MessageType.SESSION_JOINED,
                        payload: {
                            peerId: clientId,
                        },
                    })
                );
                guestSocket.send(
                    JSON.stringify({
                        type: MessageType.SESSION_JOINED,
                        payload: {
                            peerId: session.host,
                        },
                    })
                );
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



// -----------------SESSION---------------------
const sessions = new Map<string, Session>();

// session code generator
function generateSessionCode(): string {

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let code = ""

    do {
        code = ""

        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];

        }

    } while (sessions.has(code));

    return code;
}

