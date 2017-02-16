'use strict'
process.title = 'HelpTicketBot'


/* Logging
 */
var winston = require("winston");

// Configure logger
var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({
			colorize: true,
			level: 'debug'
		})
	]
});


/* Load configuration
 */
var Config;

try {
	Config = require('./config.json');
	
	// Apply configuration to logger
	for (var level in Config["defaults"]["logs"]) {
		if (Config["defaults"]["logs"].hasOwnProperty(level)) {
			logger.add(winston.transports.File, {
				name: Config["defaults"]["logs"][level]["name"],
				filename: Config["defaults"]["logs"][level]["filename"],
				level: level
			});
		}
	}
} catch (e) {
	logger.log('error', '\n' + process.title + ' could not load configuration...\n\n' + e.message);
	process.exit();
}


/* Write data to file
 */
var fs = require('fs');


/* Discord
 */
var Discord = require('discord.js');

// Create bot client
var bot = new Discord.Client();

// Hash map for active tickets ({[guild.id] guild.name => {data => guild data, ticket number => ticket object}})
var tc = require('./data/TicketCache.js'),
	TicketCache = tc.TicketCache;

// Bot is ready for action
bot.on('ready', function(event) {
	var inviteLink = require('./invite/invite.js').invite(Config["discord"]["client"]["id"], Config["defaults"]["permissions"]);
	
	logger.log('info', 'Logged in as %s - %s\n', bot.user.username, bot.user.id);
	console.log(`Invite this bot to your server: ${inviteLink}`);
	
	// Load all guild and active ticket information
	TicketCache.populateAll();
});

// Bot has joined a guild
bot.on('guildCreate', function(guild) {
	TicketCache.insert(guild);
});

// Process commands and route them to the correct module
bot.on('message', function(message) {
	// Parse out the command in the message
	var commandEnd = message.content.indexOf(' '),
		command = message.content.substring(0, (commandEnd > 0 ? commandEnd : message.length)),
		key = TicketCache.getKey(message.guild);
	
	switch (command) {
		/* Bot settings
		 */
		case '~setAdmin':
			// Register a role as having admin privileges (only one role may have admin privileges)
			TicketCache.getGuild(key).setAdmin(message);
			break;
		
		case '~setHelper':
			// Register a role as the group that help requests will be directed towards (only one role may be a responder)
			TicketCache.getGuild(key).setHelper(message);
			break;
		
		case '~setHelpTextChannel':
			// Register a text channel as a "help" channel
			TicketCache.getGuild(key).setHelpTextChannel(message);
			break;
		
		case '~setHelpVoiceChannel':
			// Register a voice channel as a "help" channel
			TicketCache.getGuild(key).setHelpVoiceChannel(message);
			break;
		
		
		/* Information about this bot
		 */
		case '^help':
			// Print a list of commands
			break;
		
		
		/* Handle help tickets
		 */
		case '!open':
			// Create a new ticket and assign it a number
			TicketCache.openTicket(bot, message);
			break;
		
		case '!reply':
			// Respond to an existing ticket by id
			TicketCache.respondTicket(bot, message);
			break;
		
		case '!close':
			TicketCache.closeTicket(bot, message);
			break;
	}
});

// Detect changes in existing messages
bot.on('messageUpdate', function(oldMessage, newMessage) {
	TicketCache.respondTicket(bot, newMessage);
});

// Disconnect notifier
bot.on('disconnect', function(errMsg, code) {
	logger.log('info', '%s - %s has has logged off\n', bot.user.username, bot.user.id);
	
	// Dump all data to cache
	TicketCache.dump();
});

// Connect using the token
bot.login(Config["discord"]["bot-user"]["token"]);