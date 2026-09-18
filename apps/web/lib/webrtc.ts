import { MessageType } from "@bridge/shared";

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void
) {

  const peer = new RTCPeerConnection(config);


  // listeneing for ice candidates from browser
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  return peer;
}

export async function createOffer(peer: RTCPeerConnection) {
  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer);

  return offer;
}

export async function setRemoteOffer(
  peer: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
) {
  await peer.setRemoteDescription(offer);

}


export async function createAnswer(peer: RTCPeerConnection) {
  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer);

  return answer;
}


export async function setRemoteAnswer(
  peer: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
) {
  await peer.setRemoteDescription(answer);
}



export async function addIceCandidate(
  peer: RTCPeerConnection,
  candidate: RTCIceCandidateInit
) {
  await peer.addIceCandidate(candidate);
}


export function createDataChannel(
  peer: RTCPeerConnection,
  onOpen: () => void,
  onClose: () => void,
  onMessage: (message: string | ArrayBuffer) => void
) {

  // creting the channel by host
  const channel = peer.createDataChannel("bridge");

  channel.bufferedAmountLowThreshold =
    4 * 1024 * 1024;
  channel.binaryType = "arraybuffer";

  // fires only once on channel creation
  channel.onopen = () => {
    onOpen();
  };

  // fires only once on channel dead
  channel.onclose = () => {
    onClose()
  };


  // ITS THE REAL MESSAGE LISTNER FROM THE GUEST FOR HOST       <-------------- ###
  channel.onmessage = (event) => {
    onMessage(event.data);
  };

  return channel;
}



// CREATING THE FUNCTION FOR HANDLING FILE TRANSFER


export async function sendFile(
  channel: RTCDataChannel,
  file: File,
  options?: {
    messageId?: string
    onProgress?: (
      sentBytes: number,
      totalBytes: number,
    ) => void
  },
) {
  // checking if  data channel is open or not 
  if (channel.readyState !== "open") {
    throw new Error("DataChannel is not open");
  }

  // now calculating the total chunk
  const totalChunks = Math.ceil(file.size / FILE_CHUNK_SIZE)

  // now telling the reciver about file incoming 
  const transferId = crypto.randomUUID();

  channel.send(
    JSON.stringify({
      type: MessageType.FILE_START,
      payload: {
        transferId,
        messageId: options?.messageId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        totalChunks,
        chunkSize: FILE_CHUNK_SIZE,
      },
    })
  );

  let sentBytes = 0;

  //now logic for sending chunks 
  for (let index = 0; index < totalChunks; index++) {

    // calculating start and end of chunk to slice the file
    const start = index * FILE_CHUNK_SIZE;
    const end = Math.min(start + FILE_CHUNK_SIZE, file.size)

    // now slicing the file 
    const chunk = await file.slice(start, end).arrayBuffer()

    // now checking the traffic before sending the chunk to channel

    while (channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      await new Promise<void>((resolve) => {
        const checkBuffer = () => {
          if (
            channel.bufferedAmount <=
            MAX_BUFFERED_AMOUNT
          ) {
            channel.removeEventListener(
              "bufferedamountlow",
              checkBuffer
            );

            resolve();
          }
        };

        channel.addEventListener(
          "bufferedamountlow",
          checkBuffer
        );
      })
    }

    channel.send(chunk)

    sentBytes += chunk.byteLength;

    options?.onProgress?.(
      sentBytes,
      file.size
    );
  }

  channel.send(
    JSON.stringify({
      type: MessageType.FILE_END,
      payload: {
        transferId,
        messageId: options?.messageId,

      },
    })
  );

}

// FILE CHUNKING LOGIC 

const FILE_CHUNK_SIZE = 64 * 1024;
const MAX_BUFFERED_AMOUNT = 4 * 1024 * 1024