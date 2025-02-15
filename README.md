# 🎵 Discord Music Bot

This bot uses [Discord.JS](https://www.npmjs.com/package/discord.js?activeTab=readme) and [@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice) to allow you to play, queue, and manage music in your Discord server using **yt-dlp** and **ffmpeg**. It supports various streaming platforms and provides a seamless music experience for your community.

## 🚀 Features
- 🎶 **Stream Music**: Play music from YouTube and other supported platforms directly into your voice channel.
- 📜 **Queue System**: Add multiple tracks to a queue and enjoy uninterrupted playback.
- ⏸ **Pause & Resume**: Easily pause and resume music playback.
- ⏭ **Skip & Stop**: Skip the current track or stop the music entirely.
- 🔄 **Auto-Play**: Continues playing tracks in the queue automatically.
- 🛠 **Stable & Efficient**: Uses `yt-dlp` and `ffmpeg` for reliable streaming with high-quality audio output.

## 🛠 Installation
### Prerequisites
Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (v16 or newer)
- [ffmpeg](https://ffmpeg.org/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)

### Setup
1. Clone the repository:
   ```sh
   git clone https://github.com/dewmguy/discordmusic.git
   cd discordmusic
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create a `.env` file in the root directory and add your bot token:
   ```env
   TOKEN=your-discord-bot-token
   CLIENT=your-discord-client-id
   ```
4. Run the bot:
   ```sh
   node index.js
   ```

### Debugging

Recommend using nodemon to help you debug.
```
npm install -g nodemon or npm install --save-dev nodemon
nodemon index.js
```

## 🔧 Commands
The bot provides several music commands to interact with:
| Command         | Description |
|----------------|-------------|
| `/music join`  | Joins voice channel |
| `/music leave` | Leaves voice channel |
| `/music queue <url>` | Queues a song |
| `/music play`  | Resumes playback |
| `/music pause` | Pauses playback |
| `/music skip`  | Skips current song |
| `/music stop`  | Stops music and leaves |

## 📜 Usage Guidelines
- Discord app requires privilaged intents.
- Discord app requires **Send Messages**, **Connect**, and **Speak** permissions.
- User need to be in the same voice channel as the bot to control playback.
- Bot will disconnect automatically if left alone in a voice channel.

## 🛠 Troubleshooting
- **Bot doesn’t respond to commands?**
  - Ensure the bot has the correct permissions in your server.
  - Check if the bot is running and connected to Discord.
- **Music doesn’t play?**
  - Make sure `ffmpeg` and `yt-dlp` are installed and accessible.
  - Uncomment related error output in the script to help debug.
  - Make sure yt-dlp is updated regularly.

## 🎤 Contributing
Contributions are welcome! Feel free to submit an issue or open a pull request.

## 📜 License
This project is licensed under the [MIT License](LICENSE).

## 🎉 Acknowledgments
- Built using [discord.js](https://discord.js.org/)
- Streaming powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/)

---
⭐ **If you like this project, consider giving it a star!** ⭐
