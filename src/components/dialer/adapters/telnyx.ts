import type { Softphone, StateListener } from "./types";

export async function createTelnyxSoftphone(loginToken: string, audio: HTMLAudioElement, onState: StateListener): Promise<Softphone> {
  const { TelnyxRTC } = await import("@telnyx/webrtc");
  const client = new TelnyxRTC({ login_token: loginToken });
  client.remoteElement = audio;

  await new Promise<void>((resolve, reject) => {
    client.on("telnyx.ready", () => resolve());
    client.on("telnyx.error", (e: unknown) => reject(new Error(String((e as { message?: string })?.message ?? "Telnyx login failed"))));
    client.connect();
  });

  type TelnyxCall = ReturnType<typeof client.newCall>;
  let call: TelnyxCall | null = null;

  client.on("telnyx.notification", (n: { type: string; call?: TelnyxCall }) => {
    if (n.type !== "callUpdate" || !n.call || n.call !== call) return;
    switch (n.call.state) {
      case "trying":
      case "requesting":
        return onState("dialing");
      case "ringing":
      case "early":
        return onState("ringing");
      case "active":
        return onState("active");
      case "hangup":
      case "destroy":
        call = null;
        return onState("ended");
    }
  });

  return {
    async call(to, from) {
      call = client.newCall({ destinationNumber: to, callerNumber: from, audio: true, video: false });
      onState("dialing");
    },
    hangup: () => void call?.hangup(),
    setMuted: (muted) => (muted ? call?.muteAudio() : call?.unmuteAudio()),
    sendDigit: (d) => call?.dtmf(d),
    destroy: () => {
      void call?.hangup();
      client.disconnect();
    },
  };
}
