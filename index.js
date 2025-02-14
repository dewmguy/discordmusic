require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { Player } = require('discord-music-player');
const Airtable = require('airtable');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const player = new Player(client, {
    leaveOnEmpty: false,
});
client.player = player;

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base('appPmhsoVLwfBFJOP');

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    const commands = [
        new SlashCommandBuilder().setName('music').setDescription('Music commands')
            .addSubcommand(sub => sub.setName('connect').setDescription('Join a voice channel'))
            .addSubcommand(sub => sub.setName('disconnect').setDescription('Leave the voice channel'))
            .addSubcommand(sub => sub.setName('queue').setDescription('Show the queue'))
            .addSubcommand(sub => sub.setName('play').setDescription('Play a song')
                .addStringOption(option => option.setName('url').setDescription('Music URL').setRequired(true)))
            .addSubcommand(sub => sub.setName('pause').setDescription('Pause music'))
            .addSubcommand(sub => sub.setName('stop').setDescription('Stop music'))
            .addSubcommand(sub => sub.setName('skip').setDescription('Skip song'))
    ].map(command => command.toJSON());
    
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.APP_ID), { body: commands });
    console.log('Slash commands registered.');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const { commandName, options } = interaction;
    const subcommand = options.getSubcommand();
    const guildQueue = client.player.getQueue(interaction.guildId);

    if (commandName === 'music') {
        if (subcommand === 'connect') {
            const channel = interaction.member.voice.channel;
            if (!channel) return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
            let queue = client.player.createQueue(interaction.guildId);
            await queue.join(channel);
            return interaction.reply('Connected to voice channel!');
        }
        if (subcommand === 'disconnect') {
            if (guildQueue) guildQueue.stop();
            return interaction.reply('Disconnected from voice channel.');
        }
        if (subcommand === 'queue') {
            if (!guildQueue || !guildQueue.songs.length) return interaction.reply('Queue is empty.');
            return interaction.reply(`Queue:
${guildQueue.songs.map(song => `- ${song.name}`).join('\n')}`);
        }
        if (subcommand === 'play') {
            const url = options.getString('url');
            const channel = interaction.member.voice.channel;
            if (!channel) return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
            let queue = client.player.createQueue(interaction.guildId);
            await queue.join(channel);
            let song = await queue.play(url).catch(err => {
                console.log(err);
                queue.stop();
            });
            
            base('music_queue').create({
                url: url,
                user: interaction.user.id,
                played: 0
            });
            
            return interaction.reply(`Now playing: ${song.name}`);
        }
        if (subcommand === 'pause') {
            if (guildQueue) guildQueue.setPaused(true);
            return interaction.reply('Music paused.');
        }
        if (subcommand === 'stop') {
            if (guildQueue) guildQueue.stop();
            return interaction.reply('Music stopped.');
        }
        if (subcommand === 'skip') {
            if (guildQueue) guildQueue.skip();
            return interaction.reply('Song skipped.');
        }
    }
});

client.player.on('songFirst', async (queue, song) => {
    console.log(`Started playing ${song.name}`);
    let records = await base('music_queue').select({ filterByFormula: `{url} = '${song.url}'` }).firstPage();
    if (records.length > 0) {
        base('music_queue').update(records[0].id, { played: 1 });
    }
});

client.login(process.env.BOT_TOKEN);
