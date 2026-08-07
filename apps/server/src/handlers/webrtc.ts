import { AnswerMessage, IceCandidateMessage, OfferMessage } from "@bridge/shared";
import { clients } from "../store/state";



export function handleOffer(data: OfferMessage) {
    const target = clients.get(data.payload.targetId)

    if (!target) {
        console.log('target not found to send the offer message from the host')
        return
    }

    target.send(JSON.stringify(data));
    console.log("Offer forwarded");
}

export function handleAnswer(data: AnswerMessage) {
    const target = clients.get(data.payload.targetId)

    if (!target) {
        console.log('target not found to send answer')
        return;
    }

    target.send(JSON.stringify(data))
    console.log("Answer forwarded");
}


export function handleIceCandidate(data: IceCandidateMessage) {
    const target = clients.get(data.payload.targetId)
    if (!target) {
        console.log("Target not found");
        return;
    }

    target.send(JSON.stringify(data));

    console.log("ICE Candidate forwarded from server to browser");

}