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


/* Tools and utilities
 */
module.exports.toHex = function(h) {
	let val = parseInt(h, 16);
	return (val.toString(16) === h ? val : undefined);
};


/* Store and access Guild and Ticket data
 */
module.exports.TicketCache = {
	// Information for all the guilds that this bot is a part of as well as all the tickets ever made on that guild
	data: {},
	
	// Directory inside which all Guild information will be stored
	guildRoot: './guilds/',
	
	// File inside which a single Guild's information will be stored
	guildInfoFile: 'guildInfo.json',
	
	// Directory inside which ticket information will be stored
	// ticketRoot: '/tickets/', // Cannot be changed
	// ticketInfoFile: 'info.json', // Cannot be changed
	
	// Directory inside which messages associated with tickets will be stored
	// messageRoot: '/messages/, // Cannot be changed
	
	
	/* Retrieve Guild data and store it in the cache
	 * 
	 * New Guilds are added when the bot joins
	 * Existing guilds are populated from a database when the bot starts up
	 * 	All guilds in the TicketCache are saved when the bot shuts down
	 */
	// Generate a new Guild from Discord.js Guild data
	insert: function(guild) {
		data[this.getKey(guild)] = Guild(guild);
	},
	
	// Retrieve previously populated Guild data from a file
	populate: function(directory) {
		data[directory] = Guild(require(this.guildRoot + directory + '/' + this.guildInfoFile));
	},
	
	// Retrieve all Guilds inside a directory
	populateAll: function() {
		var guilds = fs.readdirSync(this.guildRoot).filter(function(file, index, results) {
				return fs.statSync(path.join(this.guildRoot, file)).isDirectory() && this.isKey(file);
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
	openTicket: function(message) {
		this.data[this.getKey(message.guild)].openTicket(message);
	},
	
	// Respond to a ticket
	respondTicket: function(message) {
		this.data[this.getKey(message.guild)].respondTicket(message);
	},
	
	// Close a ticket
	closeTicket: function(message) {
		this.data[this.getKey(message.guild)].closeTicket(message);
	},
	
	
	/* Cleaning up
	 */
	// Extract tickets from a Guild and output them in array format
	unpackTickets: function(guildKey) {
		return this.data[guildKey]["tickets"];
	},
	
	// Save all Guild information (call this when the bot shuts down)
	dump: function() {
		// Create root directory
		if (!fs.existsSync(this.guildRoot))
			fs.mkdirSync(this.guildRoot);
		
		// Process all Guilds
		Promise.all(
			this.data.entries()
			.map(function(guildInfo, index, guilds) {
				// Unpack entry
				var key = guildInfo[0],
					guild = guildInfo[1];
				
				// Build destination path and get tickets
				var guildPath = this.guildRoot + key + '/',
					guildFile = guildPath + this.guildInfoFile,
					tickets = this.unpackTickets(guild);
				
				// Generate Promise
				return new Promise(function(resolve, reject) {
					// Write each guild to file
					fs.writeFile(guildFile, guild.dump(), function(err) {
						if (err)
							reject({
								operation: "writeFile",
								message: err,
								path: guildPath
							});
						
						// Output the [Tickets, path] pair for further processing
						resolve([tickets, guildPath]);
					});
				});
			}, this)
		).then(function(guilds) {
			// For each Guild, process all Tickets
			Promise.all(
				guilds.reduce(function(tickets, guildTicketInfo, index) {
					// Unpack entry
					var ticketInfo = guildTicketInfo[0],
						guildPath = guildTicketInfo[1],
						ticketPath = guildPath + '/tickets/';
					
					// Flatten Ticket array while generating new Promises
					return tickets.concat(ticketInfo.map(function(ticket, index, ticketInfo) {
						return new Promise(function(resolve, reject) {
							var ticketFile = ticketPath + ticket["id"] + '/info.json';
							
							// Write each ticket to file
							fs.writeFile(ticketPath, ticket.dump(), function(err) {
								if (err)
									reject({
										operation: "writeFile",
										message: err,
										path: ticketPath
									});
								
								resolve(file);
							});
						});
					}, ticketPath));
				}, [])
			).then(function(results) {
				// Log results
				results.forEach(function(result, index, results) {
					module.exports.TicketCacheLogger.log('info', result + ' written successfully');
				});
			}, function(errors) {
				// Log errors
				errors.forEach(function(err, index, errors) {
					module.exports.TicketCacheLogger.log('error', "An error has occurred while writing Ticket information", err);
				});
			});
		}, function(errors) {
			// Log error
			errors.forEach(function(err, index, errors) {
				module.exports.TicketCacheLogger.log('error', "An error has occurred while writing Guild information", err);
			});
		});
	}
};