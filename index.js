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
	
	// Send a greeting to #general
	guild.defaultChannel.sendMessage(Config["greeting"]);
});

// Process commands and route them to the correct module
bot.on('message', function(message) {
	// Parse out the command in the message
	var commandEnd = message.content.indexOf(' '),
		command = message.content.substring(0, (commandEnd > 0 ? commandEnd : message.length)),
		key = TicketCache.getKey(message.guild);
	
	// Prevent the bot from messing with itself
	if (message.author.id == bot.user.id)
		return;
	
	switch (command) {
		/* Bot settings
		 */
		case 'tic~setAdmin':
			// Register a role as having admin privileges (only one role may have admin privileges)
			if (validateCommand(message.content, "^" + command + " .+$"))
				TicketCache.getGuild(key).setAdmin(message);
			else
				message.reply(incorrectUsage(command, command + " *@ValidRole*"));
			
			break;
		
		case 'tic~setHelper':
			// Register a role as the group that help requests will be directed towards (only one role may be a responder)
			if (validateCommand(message.content, "^" + command + " .+$"))
				TicketCache.getGuild(key).setHelper(message);
			else
				message.reply(incorrectUsage(command, command + " *@ValidRole*"));
			
			break;
		
		case 'tic~setHelpTextChannel':
		case 'tic~setHTC':
			// Register a text channel as a "help" channel
			if (validateCommand(message.content, "^" + command + " .+$"))
				TicketCache.getGuild(key).setHelpTextChannel(message);
			else
				message.reply(incorrectUsage(command, command + " *ValidTextChannel*"));
			
			break;
		
		case 'tic~setVoiceCh':
		case 'tic~setHVC':
			// Register a voice channel as a "help" channel
			if (validateCommand(message.content, "^" + command + " .+$"))
				TicketCache.getGuild(key).setHelpVoiceChannel(message);
			else
				message.reply(incorrectUsage(command, command + " *ValidVoiceChannel*"));
			
			break;
		
		
		/* Information about this bot
		 */
		case 'tic^help':
			// Print a list of commands
			message.channel.sendMessage('**Command List**');
			break;
		
		case 'tic^about':
			// Print a brief introduction
			if (validateCommand(message.content, "^" + command + "$"))
				message.channel.sendMessage(`${Config["about-me"]}`);
			else
				message.reply(incorrectUsage(command, command));
			
			break;
		
		
		/* Handle help tickets
		 */
		case 'tic!open':
		case 'tic!o':
			if (validateCommand(message.content, "^" + command + " .+$")) {
				// Create a new ticket and assign it a number
				TicketCache.openTicket(bot, message);
				
				// Post the opening message as the initial reply
				TicketCache.respondTicket(bot, message);
			} else
				message.reply(incorrectUsage(command, command + " *inquiry*"));
			
			break;
		
		case 'tic!reply':
		case 'tic!r':
			if (validateCommand(message.content, "^" + command + "( [0-9A-Fa-f])? .+$"))
				// Respond to an existing ticket by id
				TicketCache.respondTicket(bot, message);
			else
				message.reply(incorrectUsage(command, command + " [ticket number] *response to inquiry*"));
			
			break;
		
		case 'tic!close':
		case 'tic!c':
			if (validateCommand(message.content, "^" + command + "( [0-9A-Fa-f])?( .*)?$"))
				// Close an open ticket (only a Helper role or higher may do this)
				TicketCache.closeTicket(bot, message);
			else
				message.reply(incorrectUsage(command, command + " [ticket number] [closing remarks]"));
			break;
		
		default:
			if (command.indexOf('tic') == 0)
				message.reply(unrecognizedCommand(command));
			
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


/* Bot utilities
 */
// Some commands need to be validated for format
var validateCommand = function(commandText, format) {
	return new RegExp(format, "i").test(commandText);
};

// Output an "incorrect usage" error message
var incorrectUsage = function(command, expected) {
	return `Incorrect usage of \`${command}\`, where \`${expected}\` was expected... if you need help using this command, try checking out \`tic^help\`.`;
};

// Output a "command not recognized" error message
var unrecognizedCommand = function(command) {
	return `Hmm... I don't recognize the command \`${command}\`. To show valid commands, use \`tic^help\`.`;
};


/* Process event handlers
 */
// Handles program exit
process.on('exit', function(code) {
	logger.log('info', `Process ended with exit code ${code}`);
});

// Handles Ctrl+C
process.on('SIGINT', function() {
	TicketCache.dump(function() {
		process.exit(2);
	}, function(errors) {
		process.exit(-1);
	});
});

// Handles fatal exceptions
process.on('uncaughtException', function(e) {
	logger.log('error', 'Uncaught Exception', e);
	
	TicketCache.dump(function() {
		process.exit(99);
	}, function() {
		process.exit(-1);
	});
});