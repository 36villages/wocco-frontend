import type { Softphone, StateListener } from "./types";

export async function createPlivoSoftphone(username: string, password: string, onState: StateListener): Promise<Softphone> {
  const { default: Plivo } = await import("plivo-browser-sdk");
  const plivo = new Plivo({ debug: "ERROR", permOnClick: true, closeProtection: false });
  const client = plivo.client;

  await new Promise<void>((resolve, reject) => {
    client.on("onLogin", () => resolve());
    client.on("onLoginFailed", (cause: string) => reject(new Error(`Plivo login failed: ${cause}`)));
    client.login(username, password);
  });

  client.on("onCalling", () => onState("dialing"));
  client.on("onCallRemoteRinging", () => onState("ringing"));
  client.on("onCallAnswered", () => onState("active"));
  client.on("onCallTerminated", () => onState("ended"));
  client.on("onCallFailed", (cause: string) => onState("failed", cause));

  return {
    async call(to, from) {
      // Plivo routes endpoint calls through the Plivo application's answer URL
      // (/api/dialer/plivo-answer), which reads the caller ID from this header.
      if (!client.call(to.replace(/^\+/, ""), { "X-PH-From": from.replace(/^\+/, "") })) {
        throw new Error("Plivo could not start the call");
      }
    },
    hangup: () => void client.hangup(),
    setMuted: (muted) => void (muted ? client.mute() : client.unmute()),
    sendDigit: (d) => client.sendDtmf(d),
    destroy: () => {
      client.hangup();
      client.logout();
    },
  };
}
