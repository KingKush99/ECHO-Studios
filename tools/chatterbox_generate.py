import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate cloned speech with Chatterbox TTS.")
    parser.add_argument("--text-file", required=True, help="UTF-8 text file to synthesize.")
    parser.add_argument("--voice", required=True, help="Reference voice audio file.")
    parser.add_argument("--out", required=True, help="Output WAV path.")
    args = parser.parse_args()

    text = Path(args.text_file).read_text(encoding="utf-8").strip()
    if not text:
        raise SystemExit("No text was provided.")

    import torch
    import torchaudio as ta
    from chatterbox.tts import ChatterboxTTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
    wav = model.generate(text, audio_prompt_path=args.voice)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ta.save(str(out_path), wav, model.sr)


if __name__ == "__main__":
    main()
