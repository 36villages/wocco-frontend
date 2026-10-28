import type { Softphone, StateListener } from "./types";

/**
 * Plain SIP over WebSocket via JsSIP. Used for VoIP.ms (through a WebRTC gateway such as
 * Asterisk/FreeSWITCH/Kamailio, since VoIP.ms has no WSS endpoint) and SignalWire SIP endpoints.
 * Caller ID comes from the SIP account's settings at the carrier.
 */
export async function createSipSoftphone(
  opts: { wssUrl: string; sipUri: string; password: string; displayName?: string },
  audio: HTMLAudioElement,
  onState: StateListener,
): Promise<Softphone> {
  const JsSIP = (await import("jssip")).default;
  const ua = new JsSIP.UA({
    sockets: [new JsSIP.WebSocketInterface(opts.wssUrl)],
    uri: opts.sipUri,
    password: opts.password,
    display_name: opts.displayName,
    register: true,
  });

  await new Promise<void>((resolve, reject) => {
    ua.on("registered", () => resolve());
    ua.on("registrationFailed", (e) => reject(new Error(`SIP registration failed: ${e.cause}`)));
    ua.start();
  });

  const domain = opts.sipUri.split("@")[1];
  let session: ReturnType<typeof ua.call> | null = null;

  return {
    async call(to) {
      session = ua.call(`sip:${to.replace(/^\+/, "")}@${domain}`, {
        mediaConstraints: { audio: true, video: false },
        eventHandlers: {
          progress: () => onState("ringing"),
          confirmed: () => onState("active"),
          ended: () => onState("ended"),
          failed: (e) => onState("failed", String(e.cause)),
        },
      });
      session.connection.addEventListener("track", (e: RTCTrackEvent) => {
        audio.srcObject = e.streams[0];
        void audio.play().catch(() => {});
      });
      onState("dialing");
    },
    hangup: () => {
      if (session && !session.isEnded()) session.terminate();
    },
    setMuted: (muted) => (muted ? session?.mute({ audio: true }) : session?.unmute({ audio: true })),
    sendDigit: (d) => session?.sendDTMF(d),
    destroy: () => {
      if (session && !session.isEnded()) session.terminate();
      ua.stop();
    },
  };
}
