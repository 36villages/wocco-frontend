export type CallState = "idle" | "registering" | "dialing" | "ringing" | "active" | "ended" | "failed";

export type StateListener = (state: CallState, detail?: string) => void;

/** One registered browser softphone. SDKs are loaded lazily, so only the chosen carrier's code is downloaded. */
export interface Softphone {
  call(to: string, from: string): Promise<void>;
  hangup(): void;
  setMuted(muted: boolean): void;
  sendDigit(digit: string): void;
  destroy(): void;
}
