import { wsClient } from './ws';

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for file transfer

interface PendingTransfer {
  transferId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunks: Uint8Array[];
  receivedSize: number;
  resolve: (blob: File) => void;
  reject: (err: Error) => void;
}

// ---- WebRTC File Transfer Service ----

let peerConnection: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;
let pendingSend: { file: File; resolve: () => void; reject: (err: Error) => void } | null = null;
let pendingReceive: PendingTransfer | null = null;

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// --- Sender Side: Offer file for transfer ---

export async function sendFileViaWebRTC(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const transferId = `rtc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    pendingSend = { file, resolve, reject };

    peerConnection = new RTCPeerConnection(rtcConfig);
    dataChannel = peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
    });

    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onopen = async () => {
      // Send file metadata first
      const metadata = JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        transferId,
      });
      dataChannel!.send(metadata);

      // Send file in chunks
      const buffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
        const chunk = buffer.slice(start, end);
        dataChannel!.send(chunk);
      }

      // Send end marker
      dataChannel!.send('__END__');
    };

    dataChannel.onclose = () => {
      if (pendingSend?.resolve) {
        pendingSend.resolve();
        pendingSend = null;
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send({
          type: 'webrtc_ice_candidate',
          transferId,
          candidate: event.candidate,
        });
      }
    };

    // Create and send offer
    peerConnection.createOffer().then((offer) => {
      peerConnection!.setLocalDescription(offer);
      wsClient.send({
        type: 'webrtc_offer',
        transferId,
        offer,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
      console.log('[RTC] Offer sent for', file.name);
    }).catch(reject);

    // Handle answer from receiver
    const answerHandler = (data: any) => {
      if (data.type === 'webrtc_answer' && data.transferId === transferId) {
        wsClient.off('webrtc_answer', answerHandler);
        peerConnection!.setRemoteDescription(new RTCSessionDescription(data.answer))
          .catch(reject);
      }
    };
    wsClient.on('webrtc_answer', answerHandler);

    // Handle ICE candidates from receiver
    const iceHandler = (data: any) => {
      if (data.type === 'webrtc_ice_candidate' && data.transferId === transferId) {
        peerConnection!.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch(() => {}); // ignore ICE errors
      }
    };
    wsClient.on('webrtc_ice_candidate', iceHandler);
  });
}

// --- Receiver Side: Listen for incoming offers ---

export function initWebRTCReceiver() {
  wsClient.on('webrtc_offer', async (data: any) => {
    const { transferId, offer, fileName, fileSize, fileType } = data;
    console.log('[RTC] Incoming offer:', fileName, formatSize(fileSize));

    // Auto-accept for same-account transfers
    const pc = new RTCPeerConnection(rtcConfig);

    const chunks: Uint8Array[] = [];
    let receivedSize = 0;
    let metadata: any = null;

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';

      dc.onmessage = (e) => {
        if (typeof e.data === 'string') {
          if (e.data === '__END__') {
            // File transfer complete — assemble and download
            const blob = new Blob(chunks, { type: metadata?.fileType || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = metadata?.fileName || fileName || 'received_file';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('[RTC] File received:', a.download);
            pc.close();
            return;
          }
          // First message is metadata
          try {
            metadata = JSON.parse(e.data);
          } catch {
            // ignore
          }
          return;
        }

        // Binary chunk
        const chunk = new Uint8Array(e.data as ArrayBuffer);
        chunks.push(chunk);
        receivedSize += chunk.byteLength;
        console.log(`[RTC] Receiving... ${formatSize(receivedSize)}`);
      };
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send({
          type: 'webrtc_ice_candidate',
          transferId,
          candidate: event.candidate,
        });
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsClient.send({
        type: 'webrtc_answer',
        transferId,
        answer,
      });
    } catch (err) {
      console.error('[RTC] Failed to accept offer:', err);
      pc.close();
    }
  });
}

// --- Helpers ---

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
