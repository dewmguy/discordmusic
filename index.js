"use strict";
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
require("dotenv").config();
const { spawn } = require("child_process");
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAIKEY });
const fs = require("fs");
const path = require("path");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

console.log("[system] bot is starting...");

const allowedRoles = process.env.DJROLES.split(",").map(id => id.trim());

let tracksList = [];
let trackCount = 1;

class MusicManager {
    constructor() {
        this.player = createAudioPlayer();
        console.warn("[system] player created.");
        this.playList = [];
        console.warn("[system] playlist created.");
        this.currentPlayerIndex = 0;
        this.isPlaying = false;
        this.metadataProcess = null;

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            console.log("[system] ready for next track.");
            if (this.ffmpegProcess) { this.ffmpegProcess = null; }
            if (this.currentProcess) { this.currentProcess = null; }
            this.currentPlayerIndex += 1;
            if (!this.playList[this.currentPlayerIndex]) {
                console.log("[system] no more tracks in queue.");
                return;
            }
            this.playMusic();
        });
    }

    playMusic() {
        if (this.isPlaying) return;

        try {
            if (!this.playList[this.currentPlayerIndex]) return;
            console.log(`[system] next track queued: ${this.playList[this.currentPlayerIndex].title}`);

            if (this.currentProcess) {
                console.log("[yt-dlp] stopping process.");
                if (!this.currentProcess.killed) this.currentProcess.kill("SIGTERM");
                this.currentProcess = null;
            }

            if (this.ffmpegProcess) {
                console.log("[ffmpeg] stopping process.");
                if (!this.ffmpegProcess.killed) this.ffmpegProcess.kill("SIGTERM");
                this.ffmpegProcess = null;
            }

            this.currentProcess = spawn("yt-dlp", [
                "--no-playlist",
                "-o", "-",
                "-f", "bestaudio",
                "--buffer-size", "16M",
                "--hls-prefer-ffmpeg",
                this.playList[this.currentPlayerIndex].webpage_url,
            ]);

            this.currentProcess.stdout.on("data", (chunk) => {
                //console.log(`[yt-dlp] data: ${chunk.length} bytes`);
            });

            this.currentProcess.stdout.on("error", (error) => {
                if (error.code === "EPIPE") { console.warn("[yt-dlp] EPIPE error."); }
                else { console.error("[yt-dlp] stream error:", error); }
            });

            this.currentProcess.stderr.on("data", (data) => {
                //console.error("[yt-dlp] status:", data.toString());
            });

            this.currentProcess.on("error", (error) => {
                console.error("[yt-dlp] process error:", error);
                if (error.code === "EPIPE") { console.warn("[yt-dlp] EPIPE error."); }
            });

            this.currentProcess.on("close", (code) => {
                //console.log(`[yt-dlp] process terminated (${code})`);
                this.currentProcess = null;
            });

            this.ffmpegProcess = spawn("ffmpeg", [
                "-i", "pipe:0",
                "-f", "mp3",
                "-acodec", "libmp3lame",
                "-ar", "44100",
                "-ac", "2",
                "-b:a", "192k",
                "-bufsize", "64k",
                "pipe:1",
            ], { stdio: ["pipe", "pipe", "ignore"] });

            this.ffmpegProcess.on("error", (error) => {
                console.error("[ffmpeg] process error:", error);
                if (error.code === "EPIPE") { console.warn("[ffmpeg] EPIPE error."); }
            });

            this.ffmpegProcess.on("close", (code) => {
                //console.log(`[ffmpeg] process terminated (${code})`);
                this.ffmpegProcess = null;
            });

            this.ffmpegProcess.stdout.on("error", (error) => {
                //console.error("[ffmpeg] unhappy :(");
            });

            if (this.ffmpegProcess?.stdin && !this.ffmpegProcess.killed) {
                this.currentProcess.stdout.pipe(this.ffmpegProcess.stdin).on("error", (error) => {
                    if (error.code === "EPIPE") {
                        console.warn("[yt-dlp] pipe closed.");
                    }
                });
            }

            const resource = createAudioResource(this.ffmpegProcess.stdout);
            this.player.play(resource);
            this.isPlaying = true;
            console.log("[system] pipe opened.");

        }
        catch (error) { console.error("[music] general error:", error); }
    }

    pauseMusic() {
        this.player.pause();
        this.isPlaying = true;
    }

    resumeMusic() {
        this.player.unpause();
        this.isPlaying = true;
    }

    getPlayer() {
        return this.player;
    }

    getIsPlaying() {
        return this.isPlaying;
    }

    addMusic(interaction, data) {
        if (!data) throw new Error("no music found.");
        
        tracksList.push(`[${data.title}](${data.webpage_url})`);
        let footer = trackCount === 1 ? `${data.webpage_url}` : `${trackCount} tracks added to the playlist`;
        trackCount++;
        
        let description = tracksList.join("\n");

        const embed = new EmbedBuilder()
            .setColor(embedColor[data.extractor] || 0xFF0000)
            .setAuthor({ name: data.extractor, url: data.uploader_url || undefined })
            .setTitle(`Queued Track from ${data.uploader}`)
            .setDescription(description)
            .setThumbnail(data.thumbnail)
            .setFooter({ text: footer });

        interaction.editReply({ content: "✅ Music added to queue!", embeds: [embed] });

        this.playList.push(data);
        console.log(`[system] track added to queue: ${data.title}`);
        if (!this.isPlaying) this.playMusic();
    }

    skipMusic() {
        this.player.stop();
        console.log("[system] music skipped.");
    }

    currentMusic() {
        return this.playList[this.currentPlayerIndex];
    }

    stopMusic() {
        this.isPlaying = false;
        this.player.stop();
        if (this.metadataProcess) {
          console.log("[system] terminating playlist scrape.");
          this.metadataProcess.kill("SIGTERM");
          this.metadataProcess = null;
        }
        console.log("[system] music stopped.");
    }
}

const musicManagers = new Map();

function isURL(str) {
    try {
        new URL(str);
        return true;
    }
    catch (e) { return false; }
}

async function queueMusic(interaction, query) {
    console.log(`[user] query: ${query}`)
    
    if (!isURL(query)) {
        const directive = "you are a music expert. you are provided a query from a search function. this query will come in one of a couple intended forms: artist, album, song, or any combination thereof; or song lyrics. if the user submitted a combination of song, album, or artist, your job is simply to correct typos and make corrections based on glaring inaccuracies or misconceptions, and repeat it back. lastly, if the user submitted song lyrics, your job is to make the most educated guess at the lyrics and output the song and artist name. your output will be fed directly into another app for processing, no further output is required. If you receive any other query that that seems to fit outside these parameters, do not process it, simply repeat it back.";
        const completion = await openai.chat.completions.create({
          messages: [
            { "role": "system", "content": directive },
            { "role": "user", "content": query }
          ],
          model: "gpt-4o",
        });
        query = completion.choices[0]?.message?.content || "[openai] error: api problem";
        console.log(`[chatgpt] response: ${query}`)
    }

    return new Promise((resolve, reject) => {
        const musicManager = musicManagers.get(interaction.guild.id);
        musicManager.metadataProcess = spawn("yt-dlp", [
            "--skip-download",
            "--yes-playlist",
            "--output-na-placeholder", "null",
            "--print",
            '{"id":%(id)j, "title":%(title)j, "uploader":%(uploader)j, "webpage_url":%(webpage_url)j, "uploader_url":%(uploader_url)j, "thumbnail":%(thumbnail)j, "extractor":%(extractor)j}',
            "--default-search", "ytsearch",
            query,
        ]);
        
        let count = 0;

        musicManager.metadataProcess.stdout.on("data", (data) => {
            ++count;
            try {
                const info = JSON.parse(data);
                musicManagers.get(interaction.guild.id).addMusic(interaction, info);
            }
            catch (error) {
                console.error("[yt-dlp] error parsing JSON", error.message);
            }
        });

        musicManager.metadataProcess.once("close", (code) => {
            if (code !== 0) { reject(new Error("[yt-dlp] error with results or timed out.")); }
            else { console.log("[yt-dlp] completed processing."); resolve(count); }
        });

        musicManager.metadataProcess.on("error", (error) => {
            reject(new Error(`[yt-dlp] general error: ${error.message}`));
        });
    });
}

function joinVoice(voiceChannel) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    musicManagers.set(voiceChannel.guild.id, new MusicManager());
    connection.subscribe(musicManagers.get(voiceChannel.guild.id).getPlayer());
    console.log("[system] bot connected.");
    return connection;
}

function leaveVoice(interaction, connection) {
    const guildId = interaction.guild.id;

    if (musicManagers.has(guildId)) {
        musicManagers.get(guildId).stopMusic();
        musicManagers.delete(guildId);
        connection.destroy();
        interaction.editReply("✅ Left your voice channel.");
        console.log("[system] bot disconnected.");
    }
}

const embedColor = {
    'youtube': 0xFF0033,
    'chzzk:video': 0x00FFA6,
    'chzzk:live': 0x00FFA6,
    'Instagram': 0xD80862,
    'instagram:story': 0xD80862,
    'Naver': 0x0AEA6A,
    'Naver:live': 0x0AEA6A,
    'navernow': 0x0AEA6A,
    'soundcloud': 0xFF5500,
    'twitch:stream': 0x944CFF,
    'twitch:clips': 0x944CFF,
    'twitch:vod': 0x944CFF,
    'vimeo': 0x20D5FF,
};

const commands = [
    new SlashCommandBuilder().setName("music").setDescription("Music commands")
        .addSubcommand(sub => sub.setName("join").setDescription("Join the voice channel"))
        .addSubcommand(sub => sub.setName("leave").setDescription("Leave the voice channel"))
        .addSubcommand(sub => sub.setName("queue").setDescription("Queue music").addStringOption(option => option.setName("music").setDescription("Music title or URL").setRequired(true)))
        .addSubcommand(sub => sub.setName("skip").setDescription("Skip current music"))
        .addSubcommand(sub => sub.setName("stop").setDescription("Stop playing all music"))
        .addSubcommand(sub => sub.setName("pause").setDescription("Pause the current music"))
        .addSubcommand(sub => sub.setName("play").setDescription("Resume paused music"))
].map(command => command.toJSON());

const commandHandlers = {
    music: async (interaction) => {
        if (!interaction.guild) return interaction.reply("❌ This command can only be used in a server.");
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        console.log(`[user] command: ${subcommand}`);
        const guild = interaction.guild;
        const member = guild.members.cache.get(interaction.user.id);
        const voiceChannel = member.voice.channel;
        let connection = getVoiceConnection(interaction.guild.id);

        if (!member.roles.cache.some(role => allowedRoles.includes(role.id))) {
            return interaction.editReply("⛔ You do not have permission to use the bot.");
        }

        if (!voiceChannel) return interaction.editReply("❌ Join a voice channel first!");
        else if (subcommand === "join") {
            if (connection) {
                return interaction.editReply("❌ I am already in a voice channel!");
            }
            joinVoice(voiceChannel);
            return interaction.editReply("✅ Joined your voice channel!");
        }
        else if (!connection) return interaction.editReply("❌ The bot is not in a voice channel!");
        else if (voiceChannel.id !== connection.joinConfig.channelId) {
            return interaction.editReply("❌ You cannot control the bot from outside the voice channel.");
        }

        const musicManager = musicManagers.get(interaction.guild.id);
        const currentMusic = musicManager.currentMusic();

        switch (subcommand) {
            case "leave": // disconnect
                leaveVoice(interaction, connection);
                break;

            case "queue": // NEW TEST
                try {
                    const musicQuery = interaction.options.get("music").value;
                    const count = await queueMusic(interaction, musicQuery);
                    if (count > 1) { await interaction.editReply({ content: `✅ Finished adding ${count} tracks to the queue!` }); }
                    tracksList = [];
                    trackCount = 1;
                } catch (error) {
                    console.error("[system] error:", error.message);
                    await interaction.editReply(error.message.includes("❌ No results found")
                        ? "❌ I couldn't find music matching your request."
                        : `❌ An error occurred: ${error.message}`);
                }
                break;

            case "play": // unpause
                if (!musicManager || !musicManager.getIsPlaying() || !musicManager.currentMusic()) {
                    return interaction.editReply("❌ There is no music currently paused or queued!");
                }
                musicManager.resumeMusic();
                return interaction.editReply("👉🏻▶️ Resumed the music!");

            case "pause": // unplay
                if (!musicManager || !musicManager.getIsPlaying()) return interaction.editReply("❌ There is no music currently playing or queued!");
                musicManager.pauseMusic();
                return interaction.editReply("👉🏻⏸️ Paused the music!");

            case "skip": // next track
                if (!musicManager || !musicManager.getIsPlaying()) return interaction.editReply("❌ No music is currently playing.");
                if (!currentMusic) return interaction.editReply("❌ There is no music playing to skip!");
                musicManager.skipMusic();

                const skipEmbed = new EmbedBuilder()
                    .setColor(0xd1d1d1)
                    .setTitle("👉🏻⏭️ Track skipped.")
                    .setDescription(`**${currentMusic.title}**`)
                    .setFooter({ text: `${currentMusic.webpage_url}` });

                await interaction.editReply({ embeds: [skipEmbed] });
                break;

            case "stop": // stop all music
                if (!musicManager || !musicManager.getIsPlaying()) return interaction.editReply("❌ No music is currently playing.");
                if (!currentMusic) return interaction.editReply("❌ There is no music playing to stop!");
                leaveVoice(interaction, connection);
                
                if (musicManager.metadataProcess) {
                    musicManager.metadataProcess.kill("SIGTERM");
                    musicManager.metadataProcess = null;
                }

                const stopEmbed = new EmbedBuilder()
                    .setColor(0xd1d1d1)
                    .setTitle("👉🏻⏹️ Music stopped.")
                    .setDescription(`**${currentMusic.title}**`)
                    .setFooter({ text: `${currentMusic.webpage_url}` });

                await interaction.editReply({ embeds: [stopEmbed] });
                break;
        }
    }
};

(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT), { body: commands });
        console.log("[system] registered slash commands.");
    }
    catch (error) { console.error("[system] error: failed to register slash commands:", error); }
})();

process.on("uncaughtException", (error) => {
    console.error("[system] Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("[system] Unhandled Rejection at:", promise, "reason:", reason);
});

client.on("ready", () => console.log(`[system] logged in as ${client.user.tag}.`));
client.on("voiceStateUpdate", (oldState, newState) => {
    const channel = oldState.channel;
    if (channel) {
        const botMember = channel.members.get(client.user.id);
        if (botMember && channel.members.size === 1) {
            console.log("[system] users abandoned bot. disconnecting.");
            const connection = getVoiceConnection(oldState.guild.id);
            if (connection) {
                if (musicManagers.has(oldState.guild.id)) {
                    musicManagers.get(oldState.guild.id).stopMusic();
                    musicManagers.delete(oldState.guild.id);
                }
                connection.destroy();
            }
        }
    }
});
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;
    if (!interaction.guild) return;
    const { commandName } = interaction;
    if (commandHandlers[commandName]) {
        await commandHandlers[commandName](interaction);
    }
});

client.login(process.env.TOKEN);
