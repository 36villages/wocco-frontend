import type { BrowserCredentials } from "@/lib/dialer/types";
import { createPlivoSoftphone } from "./plivo";
import { createSipSoftphone } from "./sip";
import { createTelnyxSoftphone } from "./telnyx";
import type { Softphone, StateListener } from "./types";

export type { CallState, Softphone } from "./types";

export function createSoftphone(creds: BrowserCredentials, audio: HTMLAudioElement, onState: StateListener): Promise<Softphone> {
  switch (creds.provider) {
    case "telnyx":
      return createTelnyxSoftphone(creds.loginToken, audio, onState);
    case "plivo":
      return createPlivoSoftphone(creds.username, creds.password, onState);
    case "signalwire":
    case "voipms":
      return createSipSoftphone(creds, audio, onState);
  }
}
