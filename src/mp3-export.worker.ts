import { encodeWavToMp3 } from "./mp3-export";

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const result = encodeWavToMp3(event.data);
    self.postMessage(result, { transfer: result.blocks });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "MP3 encoding failed." });
  }
};
