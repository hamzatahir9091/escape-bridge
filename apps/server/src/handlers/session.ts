import { JoinSessionMessage, MessageType } from "@bridge/shared";
import { sessions, clients } from "../store/state";
import { generateSessionCode } from "../utils/session";
import { WebSocket } from "ws";


export function handleCreateSession(socket: WebSocket,
    clientId: string) {
    const sessionCode = generateSessionCode(sessions)

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
}


export function handleJoinSession(
    socket: WebSocket,
    clientId: string,
    data: JoinSessionMessage
) {
    const code = data.payload.code;
    const session = sessions.get(code);

    if (!session) {
        console.log("Session not found");
        return

    }
    if (session.guest) {
        console.log("Session already full");
        return
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
}