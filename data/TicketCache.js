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
		
		if (!(key in this.data)) {
			this.data[key] = Guild.addGuild(key, guild);
			
			console.log(`inserted ${key}: ${guild.id}`);
			
			// Do a preliminary dump
			Promise.all(this.data[key].dump()).then(function(result) {
				module.exports.TicketCacheLogger.log('info', 'Saved information for Guild: ' + result);
				console.log(`saved ${result}`);
			}, function(error) {
				module.exports.TicketCacheLogger.log('error', 'Error saving Guild information', error);
				console.log(error);
			});
		}
	},
	
	// Retrieve previously populated Guild data from a file
	populate: function(directory) {
		this.data[directory] = Guild.loadGuild(Guild.guildRoot + directory + '/' + Guild.guildInfo);
	},
	
	// Retrieve all Guilds inside a directory
	populateAll: function() {
		// Create root directory
		if (!fs.existsSync(Guild.guildRoot))
			fs.mkdirSync(Guild.guildRoot);
		else {
			var guilds = fs.readdirSync(Guild.guildRoot).filter(function(file, index, results) {
					return fs.statSync(path.join(Guild.guildRoot, file)).isDirectory() && this.isKey(file);
				}, this);
			
			guilds.forEach(function(guild, index, guilds) {
				this.populate(guild);
			}, this);
		}
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
	 * 		If a help ticket channel exists in the Guild, the bot will log information to that channel
	 */
	// Open a ticket
	openTicket: function(botClient, message) {
		var key = this.getKey(message.guild),
			guild = this.data[key],
			openTicket = guild.openTicket(message),
			notify = this.notifyRole;
		
		if (openTicket.err)
			module.exports.TicketCacheLogger('error', 'Failed to open Ticket', openTicket.err);
		else
			openTicket.then(function(result) {
				module.exports.TicketCacheLogger.log('info', 'New ticket opened: ' + result);
				
				var splitPath = result.split("/"),
					ticketNumber = splitPath[splitPath.length - 2];
				
				notify(botClient, message, `${message.author} has opened Ticket#${ticketNumber}`, guild["roles"]["helper"]);
			}, function(error) {
				module.exports.TicketCacheLogger.log('error', 'Failed to open ticket', error);
			});
	},
	
	// Respond to a ticket
	respondTicket: function(botClient, message) {
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
			closeTicket = guild.closeTicket(message),
			notify = this.notifyUser;
		
		if (closeTicket.err)
			module.exports.TicketCacheLogger('error', 'Failed to close Ticket', closeTicket.err);
		else
			Promise.all(closeTicket).then(function(results) {
				module.exports.TicketCacheLogger.log('info', 'Ticket at ' + results[0] + ' has been closed. Closing message written to ' + results[1]);
				
				var splitPath = results[0].split("/"),
					ticketNumber = splitPath[splitPath.length - 2];
				
				notify(botClient, message, `Ticket#${ticketNumber} has been closed`, results[2]["id"]);
			}, function(errors) {
				if (!Array.isArray(errors))
					module.exports.TicketCacheLogger('error', 'Failed to edit response to Ticket', error);
				else {
					for (var i = 0; i < errors.length; i++){
						module.exports.TicketCacheLogger.log('error', 'Failed to close Ticket', errors[i]);
					}
				}
			});
	},
	
	
	/* Notifications
	 * 
	 * Notify the help text channel whenever something important happens (a ticket is opened/closed)
	 */
	// Notify a specific user by id
	notifyUser: function(botClient, message, notification, id) {
		let user = message.guild.members.get(id);
		if (user)
			message.channel.sendMessage(`${user} ${notification}`);
		else
			module.exports.TicketCacheLogger.log('error', 'Failed to notify ' + username + ': ' + notification);
	},
	
	// Notify a role by the role's name
	notifyRole: function(botClient, message, notification, roleName) {
		let role = message.guild.roles.find('name', roleName);
		if (role)
			message.channel.sendMessage(`${role} ${notification}`);
		else
			module.exports.TicketCacheLogger.log('error', 'Failed to notify ' + roleName + ': ' + notification);
	},
	
	
	/* Cleaning up
	 */
	// Save all Guild information (call this when the bot shuts down)
	dump: function(successCallback, errorCallback) {
		// Extract guilds
		var guilds = [];
		for (var key in this.data) {
			if (this.data.hasOwnProperty(key))
				guilds.push(this.data[key]);
		}
		
		// Process all Guilds
		Promise.all(guilds.reduce(function(promises, guild, index) {
			return [...promises, ...guild.dump()];
		}, [])).then(function(results) {
			if (!Array.isArray(results))
				module.exports.TicketCacheLogger.log('info', 'Saved information for Guild: ' + result);
			else {
				for (var i = 0; i < results.length; i++){
					module.exports.TicketCacheLogger.log('info', 'Saved information for Guild: ' + results[i]);
				}
			}
			
			// Callback on success
			if (successCallback)
				successCallback();
		}, function(errors) {
			if (!Array.isArray(errors))
				module.exports.TicketCacheLogger.log('error', 'Error saving Guild information', errors);
			else {
				for (var i = 0; i < errors.length; i++){
					module.exports.TicketCacheLogger.log('error', 'Error saving Guild information', errors[i]);
				}
			}
			
			// Callback on error
			if (errorCallback)
				errorCallback();
		});
	}
};