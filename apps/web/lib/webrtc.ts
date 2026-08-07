const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void
) {
  const peer = new RTCPeerConnection(config);
  console.log("peer craeted successfully! : ", peer);


  peer.onicegatheringstatechange = () => {
    console.log("ICE Gathering:", peer.iceGatheringState);
  };

  peer.oniceconnectionstatechange = () => {
    console.log("ICE Connection:", peer.iceConnectionState);
  };

  peer.onconnectionstatechange = () => {
    console.log("Connection:", peer.connectionState);
  };


  peer.onconnectionstatechange = () => {
    console.log("Connection State:", peer.connectionState);
  };

  peer.oniceconnectionstatechange = () => {
    console.log("ICE State:", peer.iceConnectionState);
  };

  // listeneing for ice candidates from browser
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
      console.log('ice candidate sent to server from browser')
    }
  };











  peer.ondatachannel = (event) => {
    const channel = event.channel;

    console.log("📡 Guest received DataChannel:", channel.label);

    channel.onopen = () => {
      console.log("🟢 DataChannel OPEN");

      // Temporary: lets you test from the browser console
      (window as any).bridgeChannel = channel;
    };

    channel.onclose = () => {
      console.log("🔴 DataChannel CLOSED");
    };

    channel.onmessage = (event) => {
      console.log("Received directly:", event.data);
    };
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
  onMessage: (message: string) => void
) {

  // creating the data channel
  const channel = peer.createDataChannel("bridge")

  // now handling the data channel

  channel.onopen = () => {
    console.log('🟢 DataChannel OPEN');


    // Temporary testing
    (window as any).bridgeChannel = channel;
  }


  channel.onclose = () => {
    console.log("🔴 DataChannel CLOSED");
  };

  channel.onmessage = (event) => {
    onMessage(event.data);
  };


  return channel;
}