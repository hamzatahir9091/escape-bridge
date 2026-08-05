import { Session } from "@bridge/shared";

// session code generator
export function generateSessionCode(  sessions: Map<string, Session>): string {

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

