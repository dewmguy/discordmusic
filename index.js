require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { Player } = require('discord-music-player');
const Airtable = require('airtable');
const axios = require('axios');
const { exec } = require('child_process');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const player = new Player(client, {
    leaveOnEmpty: false,
    ytdlOptions: {
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        }
    }
});
client.player = player;

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base('appPmhsoVLwfBFJOP');

// Function to validate URLs
async function isValidUrl(url) {
    try {
        const response = await axios.head(url);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Function to verify Airtable connection
async function testAirtableConnection() {
    try {
        await base('music_queue').select({ maxRecords: 1 }).firstPage();
        console.log('[INFO] Airtable connection successful.');
    } catch (error) {
        console.error(`[ERROR] Airtable authorization failed: ${error.message}`);
    }
}

// Function to extract video metadata using yt-dlp
async function fetchVideoMetadata(url) {
    return new Promise((resolve, reject) => {
        console.log(`[INFO] Fetching metadata for URL: ${url}`);
        exec(`yt-dlp --dump-json ${url}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`[ERROR] Failed to fetch video metadata: ${stderr}`);
                return reject(null);
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (parseError) {
                console.error(`[ERROR] Failed to parse yt-dlp output: ${parseError.message}`);
                reject(null);
            }
        });
    });
}

// Rebuild queue from Airtable
async function rebuildQueue(guildId) {
    try {
        let records = await base('music_queue').select({
            filterByFormula: "{queued} = 1",
            sort: [{ field: "order", direction: "asc" }]
        }).firstPage();

        if (records.length > 0) {
            let queue = client.player.createQueue(guildId);
            for (let record of records) {
                console.log(`[INFO] Adding to queue from Airtable: ${record.get('url')}`);
                await queue.play(record.get('url'));
            }
            console.log(`[INFO] Queue rebuilt with ${records.length} songs.`);
        }
    } catch (error) {
        console.error(`[ERROR] Failed to rebuild queue from Airtable: ${error.message}`);
    }
}

client.once('ready', async () => {
    console.log(`[INFO] Logged in as ${client.user.tag}`);
    await testAirtableConnection();
    
    const commands = [
        new SlashCommandBuilder().setName('music').setDescription('Music commands')
            .addSubcommand(sub => sub.setName('connect').setDescription('Join a voice channel'))
            .addSubcommand(sub => sub.setName('disconnect').setDescription('Leave the voice channel'))
            .addSubcommand(sub => sub.setName('queue').setDescription('Show upcoming songs'))
            .addSubcommand(sub => sub.setName('addnext').setDescription('Add song to the front of the queue')
                .addStringOption(option => option.setName('url').setDescription('Music URL').setRequired(true)))
            .addSubcommand(sub => sub.setName('add').setDescription('Add song to the end of the queue')
                .addStringOption(option => option.setName('url').setDescription('Music URL').setRequired(true)))
            .addSubcommand(sub => sub.setName('play').setDescription('Resume playback if paused'))
            .addSubcommand(sub => sub.setName('pause').setDescription('Pause music'))
            .addSubcommand(sub => sub.setName('stop').setDescription('Stop music completely'))
            .addSubcommand(sub => sub.setName('skip').setDescription('Skip the current song'))
    ].map(command => command.toJSON());
    
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.APP_ID), { body: commands });
    console.log('[INFO] Slash commands registered.');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const { commandName, options } = interaction;
    const subcommand = options.getSubcommand();
    const guildQueue = client.player.getQueue(interaction.guildId);

    console.log(`[INFO] Command received: ${commandName} ${subcommand}`);

    try {
        if (commandName === 'music') {
            if (subcommand === 'connect') {
                const channel = interaction.member.voice.channel;
                if (!channel) {
                    console.log('[ERROR] User is not in a voice channel.');
                    return interaction.reply({ content: 'You need to be in a voice channel!', flags: 64 });
                }
                
                let queue = client.player.createQueue(interaction.guildId);
                await queue.join(channel);
                console.log('[INFO] Bot joined voice channel successfully.');
                return interaction.reply('Connected to voice channel!');
            }
        }
    } catch (error) {
        console.error(`[ERROR] Unexpected error: ${error.message}`);
        return interaction.reply({ content: `An error occurred: ${error.message}`, flags: 64 });
    }
});

client.login(process.env.BOT_TOKEN);
