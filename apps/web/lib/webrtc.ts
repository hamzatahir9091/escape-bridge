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
      console.log('ice candidate sent to server from browser')
    }
  };

  return peer;
}

export async function createOffer(peer: RTCPeerConnection) {
  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer);

  console.log("localDescription =", peer.localDescription);
  console.log("iceGatheringState =", peer.iceGatheringState);

  setTimeout(() => {
    console.log("After 2 seconds:", peer.iceGatheringState);
  }, 2000);

  console.log("local desc offer :", peer.localDescription);
  console.log("local desc offer (sdp) :", peer.localDescription?.sdp);
  return offer;
}

export async function setRemoteOffer(
  peer: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
) {
  await peer.setRemoteDescription(offer);

  console.log("Remote offer set");
}


export async function createAnswer(peer: RTCPeerConnection) {
  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer);

  console.log("localDescription =", peer.localDescription);
  console.log("iceGatheringState =", peer.iceGatheringState);

  setTimeout(() => {
    console.log("After 2 seconds:", peer.iceGatheringState);
  }, 2000);

  console.log("Local description set");

  console.log("local desc answer :", peer.localDescription);
  console.log("local desc answer (sdp) :", peer.localDescription?.sdp);
  return answer;
}


export async function setRemoteAnswer(
  peer: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
) {
  await peer.setRemoteDescription(answer);

  console.log("Remote answer set");
}



export async function addIceCandidate(
  peer: RTCPeerConnection,
  candidate: RTCIceCandidateInit
) {
  await peer.addIceCandidate(candidate);

  console.log("ICE candidate added");
}


export function createDataChannel(
  peer: RTCPeerConnection,
  onOpen: () => void,
  onClose: () => void,
  onMessage: (message: string | ArrayBuffer) => void
) {

  // creting the channel by host
  const channel = peer.createDataChannel("bridge");

  channel.binaryType = "arraybuffer"; 

  // fires only once on channel creation
  channel.onopen = () => {
    console.log("🟢 DataChannel OPEN");
    onOpen();
  };

  // fires only once on channel dead
  channel.onclose = () => {
    console.log("🔴 DataChannel CLOSED");
    onClose()
  };


  // ITS THE REAL MESSAGE LISTNER FROM THE GUEST FOR HOST       <-------------- ###
  channel.onmessage = (event) => {
    onMessage(event.data);
  };

  return channel;
}



// CREATING THE FUNCTION FOR HANDLING FILE TRANSFER
export function sendFile(
  channel: RTCDataChannel,
  file: File) {

  return new Promise<void>((resolve, reject) => {

    if (channel.readyState !== "open") {
      reject(new Error("Data channel is not open , terminating reading process"))
      return;
    }

    const reader = new FileReader()

    reader.onload = () => {
      // checking if correct format readed
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("Could not read file as ArrayBuffer"))
        return;
      }

      // now sending result
      channel.send(reader.result)

      console.log(
        `📤 Sent file: ${file.name} (${file.size} bytes)`
      );

      resolve()
    }

    reader.onerror = () => {
      reject(reader.error)
    }


    reader.readAsArrayBuffer(file)

  }
  )
}