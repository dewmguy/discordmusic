# Discord Music Bot

A Discord bot built with `discord.js v14`, `discord-music-player`, and `Airtable` that allows users to play music and manage queues. Airtable is used to track requested songs and their playback status.

## Features
- **Slash Commands:** `/music connect`, `/music disconnect`, `/music queue`, `/music play <url>`, `/music pause`, `/music stop`, `/music skip`
- **Airtable Integration:** Helps manage the queue by logging requested songs and updating their played status.
- **Supports YouTube, Spotify, and Apple Music.**

## Requirements
- Node.js v16 or later
- A Discord bot token
- Airtable API Key
- FFmpeg installed

## Usage
- **Join a voice channel and use `/music play <url>` to start playing music.**
- **Use `/music queue` to view the current song queue.**
- **Pause, stop, or skip songs with `/music pause`, `/music stop`, and `/music skip`.**

## License
This project is licensed under the MIT License.
