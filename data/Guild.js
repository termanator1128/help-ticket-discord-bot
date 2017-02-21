var fs = require('fs'),
	path = require('path');
var Ticket = require('./Ticket.js');

var util = require('./util.js');


/* Path information
 */
module.exports.guildRoot = './data/guilds/';
module.exports.guildInfo = 'info.json';


/* Extract and store relevant information about a Discord Guild
 */
// Constructor for a Guild object
var Guild = function(guild, guildPath) {
	// Create a place to store tickets
	var ticketPath = guildPath + Ticket.ticketRoot;
	if (!fs.existsSync(ticketPath))
		fs.mkdirSync(ticketPath);
	
	// Output created Guild object
	return {
		"id": guild["id"],
		"name": guild["name"],
		"roles": {
			"admin": guild["roles"]["admin"],
			"helper": guild["roles"]["helper"]
		},
		"channels": {
			"help-text": guild["channels"]["help-text"],
			"help-voice": guild["channels"]["help-voice"]
		},
		
		"ticket-count": util.stringToHex(guild["ticket-count"]),
		// A queue of tickets to be handled, stored in the form [number, Ticket]
		"tickets": guild["tickets"],
		ticketFilter: guild["tickets"].reduce(function(filter, ticket, index) {
			filter[ticket["id"]] = index;
		}, {}),
		
		// A mapping of messages to ticket numbers so that messages can be quickly located for editing
		"messages": guild["messages"],
		
		
		/* Retrieving information
		 */
		// Reconstruct the key for this Guild
		getKey: function() {
			return '[' + this["id"] + '] ' + this["name"];
		},
		
		// Get a Ticket given a message
		getTicket: function(message) {
			if (this["tickets"].length == 0)
				return undefined;
			
			// If there is a Ticket number specified, it will be the second word of the message
			var secondWordStart = message.content.indexOf(' ');
			
			// Cannot find Ticket number because there's only 1 word
			if (secondWordStart == -1)
				return this["tickets"][0];
			secondWordStart += 1;
			
			// See if there is a second word of valid length
			var secondWordEnd = message.content.indexOf(' ', secondWordStart);
			if (secondWordEnd <= secondWordStart)
				secondWordEnd = message.content.length;
			
			// If a valid (hexadecimal) Ticket number is given, use it to look up the Ticket
			var ticketNumber = message.content.substring(secondWordStart, secondWordEnd);
			if (!util.stringToHex(ticketNumber))
				return this["tickets"][0];
			else if (!this.ticketFilter.hasOwnProperty(ticketNumber))
				return undefined;
			else
				return this["tickets"][this.ticketFilter(ticketNumber)];
		},
		
		
		/* Role and channel management
		 * Only guild members with an administrative role may use the setters
		 */
		// Check if a guild member (the message sender) holds an administrative role
		isAdmin: function(message) {
			let admin = message.guild.roles.find('name', this["roles"]["admin"]),
				member = message.guild.members.get(message.author.id);
			return admin && member.roles[admin.id];
		},
		
		// Check if a role exists
		existsRole: function(message, role) {
			return message.guild.roles.find('name', role);
		},
		
		// Check if a channel exists
		existsTextChannel: function(message, channelId) {
			let channel = message.guild.channels[channelId];
			return channel && channel.type == 'text';
		},
		
		existsVoiceChannel: function(message) {
			let channel = message.guild.channels[channelId];
			return channel && channel.type == 'voice';
		},
		
		// Set a new admin role
		setAdmin: function(message) {
			let newAdmin = message.content.substring(message.content.indexOf(' ') + 1);
			
			if (this.isAdmin(message) && this.existsRole(message, newAdmin))
				this["roles"]["admin"] = newAdmin;
		},
		
		// Set a new helper role
		setHelper: function(message) {
			let newHelper = message.content.substring(message.content.indexOf(' ') + 1),
				helperRole = this.existsRole(message, newHelper);
			
			if (this.isAdmin(message) && helperRole)
				this["roles"]["helper"] = helperRole.name;
		},
		
		// Set a new text channel for help tickets
		setHelpTextChannel: function(message) {
			if (this.isAdmin(message) && this.existsTextChannel(message))
				this["channels"]["help-text"] = message.content.substring(message.content.indexOf(' ') + 1);
		},
		
		// Set a new voice channel for help-tickets
		setHelpVoiceChannel: function(message) {
			if (this.isAdmin(message) && this.existsVoiceChannel(message))
				this["channels"]["help-voice"] = message.content.substring(message.content.indexOf(' ') + 1);
		},
		
		
		/* Updating Ticket data
		 */
		// Open a ticket
		openTicket: function(message) {
			var newTicket = Ticket.openTicket(util.toHexString(++this["ticket-count"]), message, guildPath);
			
			// Enqueue the ticket and do an initial dump
			this[newTicket["id"]] = this["tickets"].length;
			this["tickets"].push(newTicket);
			return newTicket.dump();
		},
		
		// Respond to a ticket
		respondTicket: function(message) {
			// Check if there is a valid ticket to respond to
			var ticket = this.getTicket(message);
			if (!ticket)
				return {
					err: 'Ticket not found'
				};
			
			// Make an entry in the message mapping
			this["messages"][message.createdTimestamp] = ticket["id"];
			
			// Record message
			return ticket.respond(message.author, message.content, message.createdTimestamp);
		},
		
		// Edit a response to a ticket
		editTicketResponse: function(message) {
			if (!this["messages"].hasOwnProperty(message.createdTimestamp))
				return {
					err: 'Message not associated with any Ticket'
				};
			
			// Look up the ticket number through the message's timestamp
			var ticketNumber = this["messages"][message.createdTimestamp],
				ticket = this["tickets"][this.ticketFilter[ticketNumber]];
			
			// Record edited messsage
			return ticket.editResponse(message.content, message.createTimestamp, message.editedTimestamp);
		},
		
		// Close a ticket
		closeTicket: function(message) {
			// Check if there is a valid ticket to close
			var ticket = this.getTicket(message);
			if (!ticket)
				return {
					err: 'Ticket not found'
				};
			
			// Dequeue and close the ticket
			this["tickets"].splice(this.ticketFilter[ticket["id"]], 1);
			delete this.ticketFilter[ticket["id"]];
			return ticket.close(message.author.username, message.content, message.createdTimestamp);
		},
		
		
		/* Saving information
		 */
		// Extract writeable data as JSON, outputting a Promise that will write the file when invoked
		dump: function() {
			// Convert Ticket queue to a writeable form
			var tickets = this["tickets"].map(function(ticket, index, tickets) {
					return ticket["id"];
				}),
				// Dump tickets as well as data
				dmp = this["tickets"].map(function(ticket, index, tickets) {
					return ticket.dump();
				}),
				data = JSON.stringify({
					"id": this["id"],
					"name": this["name"],
					"roles": this["roles"],
					"channels": this["channels"],
					"ticket-count": util.toHexString(this["ticket-count"]),
					"tickets": tickets,
					"messages": this["messages"]
				}),
				file = guildPath + module.exports.guildInfo;
			
			// Create directory if it doesn't exist
			if (!fs.existsSync(guildPath))
				fs.mkdirSync(guildPath);
			
			// Create a Promise that will be used externally and add it to the list of Promises
			dmp.push(new Promise(function(resolve, reject) {
				fs.writeFile(file, data, util.writeFileCallback("Guild.dump()", guildPath, resolve, reject));
			}));
			
			return dmp;
		}
	};
};

// Create a Guild from Discord.js Guild information
module.exports.addGuild = function(key, guild) {
	// Create a folder for this guild and its information if it does not yet exist
	var guildPath = module.exports.guildRoot + key;
	if (!fs.existsSync(guildPath))
		fs.mkdirSync(guildPath);
	guildPath += '/';
	
	return Guild({
		"id": guild.id,
		"name": guild.name,
		"roles": {
			"admin": "Bot Commander",
			"helper": "Assistant"
		},
		"channels": {
			"help-text": "help-tickets",
			"help-voice": "Help Tickets"
		},
		"ticket-count": "0",
		"tickets": [],
		"messages": {},
	}, guildPath);
};

// Load a Guild from file
module.exports.loadGuild = function(pathToGuildFile) {
	var data = require(path.resolve(pathToGuildFile)),
		// Strip out the info file to get the path to this Guild
		guildPath = pathToGuildFile.substring(0, pathToGuildFile.indexOf(module.exports.guildInfo));
	
	// Rebuild ticket objects
	data["tickets"] = data["tickets"].map(function(ticketNumber, index, ticketNumbers) {
		return Ticket.loadTicket(guildPath + Ticket.ticketRoot + ticketNumber + '/' + Ticket.ticketFile);
	});
	
	return Guild(data, guildPath);
};