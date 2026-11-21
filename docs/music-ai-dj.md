# Starry AI DJ setup

## Backend environment

Set these variables in the Starry bot service (for example, Render's service environment), not in the dashboard or browser:

- `OPENAI_API_KEY` — required to enable the AI DJ planner.
- `OPENAI_MUSIC_MODEL` — optional; defaults to `gpt-5.4-mini`.

The API key is used only by the server-side Responses API client. Never put it in `public/`, dashboard JavaScript, Discord messages, logs, or a committed `.env` file. OpenAI API usage may incur charges according to the selected project's billing and model pricing.

## Usage

Run `/dj request:<your mood or music brief>`, for example:

- `/dj request: upbeat house and disco for a sunny drive`
- `/dj request: melodic late-night synthwave, no vocals`
- `/dj request: energetic pop-punk and alternative for a workout`

Starry asks the model for a short recommendation plan, then resolves each search query through the live music provider before it enters the queue. The model does not generate or stream audio and cannot guarantee that a specific source is available.

AI DJ enables autoplay and stay-connected mode for the session. Use `/stay` to toggle stay-connected mode, or `/stop` to stop and leave voice. The existing manual Equalizer remains available.

## Fallback behaviour

Without `OPENAI_API_KEY`, regular `/play`, provider search, manual filters, and non-AI autoplay continue to work. The `/dj` command gives a setup message instead of silently pretending that an AI plan was generated. If the API is unavailable or returns unusable output during an existing AI DJ session, the music manager continues with its built-in provider-based recommendation path.

## Audio quality notes

Starry applies its automatic Studio master and controlled Bass profile on the audio engines. Output quality still depends on the provider's source file, the active Lavalink/native engine, server and channel bitrate limits, network stability, and Discord's voice encoding. A 384 kbps channel bitrate does not make a lower-quality source lossless.
