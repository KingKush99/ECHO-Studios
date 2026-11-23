import { Mp3Encoder } from "@breezystack/lamejs";

export function encodeWavToMp3(wav: ArrayBuffer) {
  const view = new DataView(wav);
  const marker = (offset: number) => view.getUint32(offset, false);
  if (view.byteLength < 44 || marker(0) !== 0x52494646 || marker(8) !== 0x57415645) throw new Error("The audio engine did not return a WAV file.");
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let audioStart = 0;
  let audioBytes = 0;
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > view.byteLength) break;
    if (marker(offset) === 0x666d7420 && size >= 16) {
      format = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      sampleRate = view.getUint32(start + 4, true);
      bits = view.getUint16(start + 14, true);
    } else if (marker(offset) === 0x64617461) {
      audioStart = start;
      audioBytes = size;
    }
    offset = start + size + (size % 2);
  }
  if (!audioBytes || ![1, 2].includes(channels) || ![22050, 24000, 32000, 44100, 48000].includes(sampleRate) ||
    !((format === 1 && bits === 16) || (format === 3 && bits === 32))) throw new Error("The WAV format cannot be exported as MP3.");

  const width = bits / 8;
  const frames = Math.floor(audioBytes / (channels * width));
  const encoder = new Mp3Encoder(channels, sampleRate, channels === 1 ? 80 : 128);
  const read = (offset: number) => format === 1 ? view.getInt16(offset, true) : Math.round(Math.max(-1, Math.min(1, view.getFloat32(offset, true))) * 32767);
  const blocks: ArrayBuffer[] = [];
  for (let start = 0; start < frames; start += 1152) {
    const length = Math.min(1152, frames - start);
    const left = new Int16Array(length);
    const right = new Int16Array(channels === 2 ? length : 0);
    for (let index = 0; index < length; index += 1) {
      const offset = audioStart + (start + index) * channels * width;
      left[index] = read(offset);
      if (channels === 2) right[index] = read(offset + width);
    }
    const block = encoder.encodeBuffer(left, channels === 2 ? right : left);
    if (block.length) blocks.push(Uint8Array.from(block).buffer);
  }
  const last = encoder.flush();
  if (last.length) blocks.push(Uint8Array.from(last).buffer);
  return { blocks, duration: frames / sampleRate };
}
