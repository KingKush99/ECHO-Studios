import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate natural or cloned speech with Chatterbox TTS.")
    parser.add_argument("--text-file", help="UTF-8 text file to synthesize.")
    parser.add_argument("--segments-file", help="JSON file containing text and optional voice paths.")
    parser.add_argument("--voice", help="Optional reference voice audio file.")
    parser.add_argument("--out", required=True, help="Output WAV path.")
    args = parser.parse_args()

    if not args.text_file and not args.segments_file:
        raise SystemExit("Provide --text-file or --segments-file.")

    if args.segments_file:
        payload = json.loads(Path(args.segments_file).read_text(encoding="utf-8"))
        segments = [
            {
                "text": str(item.get("text", "")).strip(),
                "voice": str(item.get("voice", "")).strip() or None,
            }
            for item in payload.get("segments", [])
            if str(item.get("text", "")).strip()
        ]
    else:
        text = Path(args.text_file).read_text(encoding="utf-8").strip()
        segments = [{"text": text, "voice": args.voice}]

    if not segments:
        raise SystemExit("No text was provided.")

    import torch
    import torchaudio as ta
    from chatterbox.tts import ChatterboxTTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
    rendered = []
    for index, segment in enumerate(segments):
        voice = segment["voice"]
        generate_args = {
            "exaggeration": 0.58,
            "cfg_weight": 0.42,
        }
        if voice:
            generate_args["audio_prompt_path"] = voice
        wav = model.generate(segment["text"], **generate_args)
        if wav.ndim == 1:
            wav = wav.unsqueeze(0)
        rendered.append(wav.cpu())
        if index < len(segments) - 1:
            rendered.append(torch.zeros((wav.shape[0], int(model.sr * 0.18)), dtype=wav.dtype))

    wav = torch.cat(rendered, dim=-1)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ta.save(str(out_path), wav, model.sr)


if __name__ == "__main__":
    main()
