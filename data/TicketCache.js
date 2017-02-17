var fs = require('fs'),
	path = require('path');

var Guild = require('./Guild.js');


/* Debugging
 */
module.exports.TicketCacheLogger = {
	logger: undefined,
	
	setLogger: function(logger) {
		this.logger = logger
	},
	log: function(level, message, data) {
		if (this.logger)
			this.logger.log(level, message, data);
		else
			console.log("Logger not set");
	}
};


/* Path information
 */
// Directory inside which all Guild information will be stored
module.exports.guildRoot = './data/guilds/';

// File inside which a single Guild's information will be stored
module.exports.guildInfoFile = 'guildInfo.json';


/* Store and access Guild and Ticket data
 */
module.exports.TicketCache = {
	// Information for all the guilds that this bot is a part of as well as all the tickets ever made on that guild
	data: {},
	
	
	/* Retrieve Guild data and store it in the cache
	 * 
	 * New Guilds are added when the bot joins
	 * Existing guilds are populated from a database when the bot starts up
	 * 	All guilds in the TicketCache are saved when the bot shuts down
	 */
	// Generate a new Guild from Discord.js Guild data
	insert: function(guild) {
		var key = this.getKey(guild);
		this.data[key] = Guild.addGuild(key, guild);
		
		// Do a preliminary dump
		this.data[key].dump().then(function(result) {
			module.exports.TicketCacheLogger.log('info', 'Saved information for Guild: ' + result);
		}, function(error) {
			module.exports.TicketCacheLogger.log('error', 'Error saving Guild information', error);
		});
	},
	
	// Retrieve previously populated Guild data from a file
	populate: function(directory) {
		this.data[directory] = Guild.loadGuild(module.exports.guildRoot + directory + '/' + module.exports.guildInfoFile);
	},
	
	// Retrieve all Guilds inside a directory
	populateAll: function() {
		var guilds = fs.readdirSync(module.exports.guildRoot).filter(function(file, index, results) {
				return fs.statSync(path.join(module.exports.guildRoot, file)).isDirectory() && this.isKey(file);
			}, this);
		
		guilds.forEach(function(guild, index, guilds) {
			this.populate(guild);
		}, this);
	},
	
	
	/* Accessing data using a given Discord.js Guild
	 * 
	 * Guild information is extracted and stored, using a unique key as an index
	 */
	// Hash a Discord.js Guild object
	getKey: function(guild) {
		return '[' + guild.id + '] ' + guild.name;
	},
	
	// Determine whether or not a string is in the format of a key of the TicketCache
	isKey: function(string) {
		return new RegExp(/\[[0-9]{18}\] [a-zA-z]+/).test(string);
	},
	
	// Retrieve a Guild object by its key
	getGuild: function(key) {
		return this.data[key];
	},
	
	
	/* Updating Ticket data through Discord messages
	 * 
	 * Tickets are specific to Guilds
	 * 	Each Guild maintains its own counter for number of Tickets opened
	 * 	Tickets can be made from any channel in the Guild
	 * 		If a help ticket channel exists in the guild, the bot will log information to that channel
	 */
	// Open a ticket
	openTicket: function(botClient, message) {
		var openTicket = this.data[this.getKey(message.guild)].openTicket(message);
		
		if (openTicket.err)
			module.exports.TicketCacheLogger('error', 'Failed to open Ticket', openTicket.err);
		else
			openTicket.then(function(result) {
				module.exports.TicketCacheLogger.log('info', 'New ticket opened: ' + result);
			}, function(err) {
				module.exports.TicketCacheLogger.log('error', 'Failed to open ticket', error);
			});
	},
	
	// Respond to a ticket
	respondTicket: function(message) {
		var respondTicket = this.data[this.getKey(message.guild)].respondTicket(message)
		
		if (respondTicket.err)
			module.exports.TicketCacheLogger('error', 'Failed to respond to Ticket', respondTicket.err);
		else
			respondTicket.then(function(result) {
				module.exports.TicketCacheLogger.log('info', 'Responded to Ticket: ' + result);
			}, function(error) {
				module.exports.TicketCacheLogger.log('error', 'Failed to respond to Ticket', error);
			});
	},
	
	// Edit a response to a ticket
	editTicketResponse: function(message) {
		var editTicketResponse = this.data[this.getKey(message.guild)].editTicketResponse(message);
		
		if (editTicketResponse.err)
			module.exports.TicketCacheLogger('error', 'Failed to edit response to Ticket', editTicketResponse.err);
		else
			editTicketResponse.then(function(result) {
				module.exports.TicketCacheLogger.log('info', 'Edited a response to a Ticket: ' + result);
			}, function(error) {
				module.exports.TicketCacheLogger('error', 'Failed to edit response to Ticket', error);
			});
	},
	
	// Close a ticket
	closeTicket: function(botClient, message) {
		var key = this.getKey(message.guild),
			guild = this.data[key],
			closeTicket = guild.closeTicket(message);
		
		if (closeTicket.err)
			module.exports.TicketCacheLogger('error', 'Failed to close Ticket', closeTicket.err);
		else
			Promise.all(closeTicket).then(function(results) {
				module.exports.TicketCacheLogger.log('info', 'Ticket at ' + results[0] + ' has been closed. Closing message written to ' + results[1]);
			}, function(errors) {
				errors.forEach(function(error, index, errors) {
					this.log('error', 'Failed to close Ticket', error);
				}, module.exports.TicketCacheLogger);
			});
	},
	
	
	/* Notifications
	 * 
	 * Notify the help text channel whenever something important happens (a ticket is opened/closed)
	 */
	// Notify a specific user
	notifyUser: function(botClient, message, notification, username) {
		let user = message.server.members.get('name', username);
		if (user)
			botClient.sendMessage(message, `${user} ${notification}`);
		else
			module.exports.TicketCacheLogger.log('error', 'Failed to notify ' + username + ': ' + notification);
	},
	
	// Notify a role
	notifyRole: function(botClient, message, notification, roleName) {
		let role = message.server.roles.get('name', roleName);
		if (role)
			botClient.sendMessage(message, `${role} ${notification}`);
		else
			module.exports.TicketCacheLogger.log('error', 'Failed to notify ' + username + ': ' + notification);
	},
	
	
	/* Cleaning up
	 */
	// Save all Guild information (call this when the bot shuts down)
	dump: function() {
		// Create root directory
		if (!fs.existsSync(module.exports.guildRoot))
			fs.mkdirSync(module.exports.guildRoot);
		
		// Process all Guilds
		Promise.all(Object.entries(this.data).map(function(guild, index, guilds) {
			return guild[1].dump();
		})).then(function(results) {
			results.forEach(function(result, index, results) {
				this.log('info', 'Saved information for Guild: ' + result);
			}, module.exports.TicketCacheLogger);
		}, function(errors) {
			errors.forEach(function(error, index, errors) {
				this.log('error', 'Error saving Guild information', error);
			}, module.exports.TicketCacheLogger);
		});
	}
};