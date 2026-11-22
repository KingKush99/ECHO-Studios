# ECHO Studios

ECHO Studios is a free prompt-to-podcast maker. It creates podcast scripts from text prompts, defaults to an average 60-minute production target capped at one hour, accepts optional image references with notes, plays drafts through local neural TTS when installed, and exports transcript/show-note/RSS files.

## Run Locally

Prerequisite: Node.js

1. Install dependencies:
   `npm install`
2. Optional, but strongly recommended for non-robotic voices:
   `.\install-piper.ps1`
3. Optional, for the highest-quality no-key local voice and voice cloning:
   `.\install-chatterbox.ps1`
4. Run the app:
   `npm run dev`
5. Open:
   `http://localhost:3174`

No API key is required for the free local mode.

### Generate scripts with Ollama

1. Install [Ollama](https://ollama.com/download) and keep it running on the same machine as ECHO Studios.
2. Use `ollama list` to check your installed models. To install an example model, run `ollama pull qwen3-vl:4b-instruct`.
3. Add `OLLAMA_MODEL=qwen3-vl:4b-instruct` to a `.env` file in the project root, using the exact name of your installed model. Restart ECHO Studios and generate an episode as usual.

Ollama writes dialogue for your selected cast and language using the episode prompt, image notes, and available research. Longer episodes are written in sections and may take several minutes. The actual length varies. The preview shows the estimated length and whether local AI or the built-in templates wrote the draft. The app uses the templates when Ollama is disabled or cannot produce a valid script.

### Voice playback

Browser speech is only a fallback and can sound robotic. For better free local voices, install Piper with `.\install-piper.ps1`, restart the app, create an episode, then use `Generate Neural Sample` in the player.

Install Chatterbox with `.\install-chatterbox.ps1` and restart ECHO Studios for natural local speech. The player uses Chatterbox HD by default when available, and Play loads the episode in short sections. Generate HD Audio renders the whole episode. Its built-in natural voice needs no upload. To give hosts distinct Chatterbox voices, assign each one a voice reference you have permission to use. Piper Cast uses separate installed local voices without reference uploads and is faster on CPU.

The local workflow requires no API key. If you configure `ELEVENLABS_API_KEY` separately, ElevenLabs appears as an optional hosted provider in Audio Settings and requires a manual selection.

## GitHub Pages

This repo includes a GitHub Actions workflow that builds the Vite app and deploys the static `dist` output to GitHub Pages. In the repository settings, set Pages to deploy from **GitHub Actions**, not from the raw `main` branch.

GitHub Pages is static hosting. It can load the frontend, but it cannot run the Express `/api/*` routes for server-side podcast generation, RSS helpers, live feeds, or neural audio. Use local `npm run dev` or a server host like Vercel for the full app backend.
