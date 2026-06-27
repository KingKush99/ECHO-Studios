# ECHO Studios

ECHO Studios is a free prompt-to-podcast maker. It creates podcast scripts from text prompts, defaults to an average 60-minute production target capped at one hour, accepts optional image references with notes, plays drafts through local neural TTS when installed, and exports transcript/show-note/RSS files.

## Run Locally

Prerequisite: Node.js

1. Install dependencies:
   `npm install`
2. Optional, but strongly recommended for non-robotic voices:
   `.\install-piper.ps1`
3. Optional, for no-key local voice cloning from an uploaded reference:
   `.\install-chatterbox.ps1`
4. Run the app:
   `npm run dev`
5. Open:
   `http://localhost:3174`

No API key is required for the free local mode.

Browser speech is only a fallback and can sound robotic. For better free local voices, install Piper with `.\install-piper.ps1`, restart the app, create an episode, then use `Generate Neural Sample` in the player.

For free local voice cloning, install Chatterbox with `.\install-chatterbox.ps1`, upload a voice reference you have permission to use, generate an episode, choose `Local Clone` in the player, then generate an audio sample. This does not require an API key, but it runs on your machine and can be slow without a GPU.

For ElevenLabs-level hosted quality, set `ELEVENLABS_API_KEY` in `.env` or in your Vercel environment variables.

## GitHub Pages

This repo includes a GitHub Actions workflow that builds the Vite app and deploys the static `dist` output to GitHub Pages. In the repository settings, set Pages to deploy from **GitHub Actions**, not from the raw `main` branch.

GitHub Pages is static hosting. It can load the frontend, but it cannot run the Express `/api/*` routes for server-side podcast generation, RSS helpers, live feeds, or neural audio. Use local `npm run dev` or a server host like Vercel for the full app backend.
