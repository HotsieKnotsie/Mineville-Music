const Discord = require("discord.js");
const { Client, Util } = require('discord.js');
const client = new Discord.Client();
const { prefix, token, managerrole } = require("./botconfig.json");
const YouTube = require('simple-youtube-api');
const youtube = new YouTube("AIzaSyBHYnMZDlV0X5pAliJA8ZsvOoEaUCG3Q4k");
const ytdl = require('ytdl-core');
const queue = new Map();

 client.on("ready", async () => {
  console.log(`De bot staat aan!`);
  client.user.setActivity("Music");
});

client.on('message', async msg => { // eslint-disable-line
const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(prefix.length)

	if (command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('Je moet in een voice channel zitten om muziek af te spelen!');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('Ik heb geen permissie om te connecten!');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('Ik heb geen permissie om te praten!');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`✅ Playlist: **${playlist.title}** staat nu in de wachtrij!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Nummer kiezen:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
Typ het nummer wat je wilt in de chat.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('Er is niks gekozen.');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 Ik kon niks vinden.');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip') {
	    if (!msg.member.roles.some(r => [`${managerrole}`].includes(r.name))) return msg.channel.send("dit kan jij niet!");
		if (!msg.member.voiceChannel) return msg.channel.send('Je zit niet in een voicechannel!');
		if (!serverQueue) return msg.channel.send('Er wordt niks afgespeeld.');
		serverQueue.connection.dispatcher.end('Er is geskipt!');
		return undefined;
	} else if (command === 'stop') {
	    if (!msg.member.roles.some(r => [`${managerrole}`].includes(r.name))) return msg.channel.send("dit kan jij niet!");
		if (!msg.member.voiceChannel) return msg.channel.send('Je zit niet in een voicechannel!');
		if (!serverQueue) return msg.channel.send('Er wordt niks afgespeeld.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('De bot is gestopt!');
		return undefined;
	} else if (command === 'volume') {
	    if (!msg.member.roles.some(r => [`${managerrole}`].includes(r.name))) return msg.channel.send("dit kan jij niet!");
		if (!msg.member.voiceChannel) return msg.channel.send('Je zit niet in een voicechannel!');
		if (!serverQueue) return msg.channel.send('Er wordt niks afgespeeld.');
		if (!args[1]) return msg.channel.send(`Het huidige volume is: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`Ik heb het volume op **${args[1]}** gezet`);
	} else if (command === 'np') {
		if (!serverQueue) return msg.channel.send('Er wordt niks afgespeeld.');
		return msg.channel.send(`🎶 Nu speelt: **${serverQueue.songs[0].title}**`);
	} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('Er wordt niks afgespeeld.');
		return msg.channel.send(`
__**Song queue:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
**Now playing:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause') {
	    if (!msg.member.roles.some(r => [`${managerrole}`].includes(r.name))) return msg.channel.send("dit kan jij niet!");
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ De muziek is nu gepauzeerd');
		}
		return msg.channel.send('There is nothing playing.');
	} else if (command === 'resume') {
	    if (!msg.member.roles.some(r => [`${managerrole}`].includes(r.name))) return msg.channel.send("dit kan jij niet!");
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ De muziek gaat nu weer verder!');
		}
		return msg.channel.send('Er wordt niks afgespeeld.');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`I could not join the voice channel: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`I could not join the voice channel: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** has been added to the queue!`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 Ik speel nu: **${song.title}**`);
}


client.login(process.env.BOT_TOKEN);
