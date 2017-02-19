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

tc.TicketCacheLogger.setLogger(logger);

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
		case 'tic~setAdmin':
			// Register a role as having admin privileges (only one role may have admin privileges)
			TicketCache.getGuild(key).setAdmin(message);
			break;
		
		case 'tic~setHelper':
			// Register a role as the group that help requests will be directed towards (only one role may be a responder)
			TicketCache.getGuild(key).setHelper(message);
			break;
		
		case 'tic~setHelpTextChannel':
		case 'tic~setHTC':
			// Register a text channel as a "help" channel
			TicketCache.getGuild(key).setHelpTextChannel(message);
			break;
		
		case 'tic~setVoiceCh':
		case 'tic~setHVC':
			// Register a voice channel as a "help" channel
			TicketCache.getGuild(key).setHelpVoiceChannel(message);
			break;
		
		
		/* Information about this bot
		 */
		case 'tic^help':
			// Print a list of commands
			break;
		
		case 'tic^about':
			// Print a brief introduction
			break;
		
		
		/* Handle help tickets
		 */
		case 'tic!open':
		case 'tic!o':
			// Create a new ticket and assign it a number
			TicketCache.openTicket(bot, message);
			
			// Post the opening message as the initial reply
			TicketCache.respondTicket(bot, message);
			break;
		
		case 'tic!reply':
		case 'tic!r':
			// Respond to an existing ticket by id
			TicketCache.respondTicket(bot, message);
			break;
		
		case 'tic!close':
		case 'tic!c':
			// Close an open ticket (only a Helper role or higher may do this)
			TicketCache.closeTicket(bot, message);
			break;
		
		default:
			
			break;
	}
});

// Detect changes in existing messages
bot.on('messageUpdate', function(oldMessage, newMessage) {
	TicketCache.editTicketResponse(newMessage);
});

// Disconnect notifier
bot.on('disconnect', function(errMsg, code) {
	logger.log('info', '%s - %s has has logged off\n', bot.user.username, bot.user.id);
	
	// Dump all data to cache
	TicketCache.dump();
});

// Connect using the token
bot.login(Config["discord"]["bot-user"]["token"]);


/* Process event handlers
 */

// Handles program exit
process.on('exit', function(code) {
	
});

// Handles Ctrl+C
process.on('SIGINT', function() {
	process.exit(2);
});

// Handles fatal exceptions
process.on('uncaughtException', function(e) {
	logger.log('error', 'Uncaught Exception', e);
	process.exit(99);
});