var fs = require('fs');
var Ticket = require('./Ticket.js');


/* Where the Guild will be stored
 */
module.exports.guildRoot = './guilds/';
module.exports.guildInfo = '/info.json';


/* Extract and store relevant information about a Discord Guild
 */
module.exports.Guild = function(guild) {
	// Rebuild ticket objects
	var tickets = undefined;
	if (guild["tickets"])
		tickets = guild["tickets"].map(function(elem) {
			return [elem, Ticket(require('./tickets/' + elem + '/info.json'))];
		});
	
	// Output a guild object
	return {
		"id": guild.id || guild["id"],
		"name": guild.name || guild["name"],
		"roles": {
			"admin": guild["roles"]["admin"] || "Bot Commander",
			"helper": guild["roles"]["helper"] || "Assistant",
		},
		"channels": {
			"help-text": guild["help-text"] || "help-tickets",
			"help-voice": guild["help-voice"] || "Help Tickets"
		},
		
		// A queue of tickets to be handled, stored in the form [number, Ticket]
		"tickets": tickets || [],
		
		// A mapping of messages to ticket numbers so that messages can be quickly located for editing
		"messages": guild["messages"] || {},
		
		
		/* Role and channel management
		 * Only guild members with an administrative role may use the setters
		 */
		// Check if a guild member (the message sender) holds an administrative role
		isAdmin: function(message) {
			let admin = message.guild.roles.get('name', this["roles"]["admin"]),
				member = message.guild.members[message.author.id];
			return admin && member.roles[admin.id];
		},
		
		// Check if a role exists
		existsRole: function(message, role) {
			return message.guild.roles.get('name', role);
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
			let newHelper = message.content.substring(message.content.indexOf(' ') + 1);
			
			if (this.isAdmin(message) && this.existsRole(message, newHelper))
				this["roles"]["helper"] = newHelper;
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
			
			// Enqueue the ticket
		},
		
		// Respond to a ticket
		respondTicket: function(message) {
			var ticketNumber = undefined;
			
			// Make an entry in the message mapping
			this["messages"][message.createdTimestamp] = ticketNumber;
		},
		
		// Close a ticket
		closeTicket: function(message) {
			
			// Dequeue the ticket
		},
		
		
		/* Notifications
		 */
		// Generate a notification whenever a ticket gets closed
		notifyClosedTicket: function(message, Ticket) {
			
		},
		
		
		/* Saving information
		 */
		// Reconstruct the key for this Guild
		getKey: function() {
			return '[' + this["id"] + '] ' + this["name"];
		},
		
		// Extract writeable data as JSON, outputting a Promise that will write the file when invoked
		dump: function(dirName) {
			// Convert Ticket queue to a writeable form
			var tickets = this["tickets"].map(function(elem) {
					return elem[0];
				}),
				directory = module.exports.guildRoot + (dirName || this.getKey()),
				file = directory + module.exports.guildInfo;
			
			// Create directory if it doesn't exists
			if (!fs.existsSync(directory))
				fs.mkdirSync(directory);
			
			// Create a Promise that will be used externally
			return new Promise(function(resolve, reject) {
				fs.writeFile(file, JSON.stringify({
					"id": this["id"],
					"name": this["name"],
					"roles": this["roles"],
					"channels": this["channels"],
					"tickets": tickets,
					"messages": this["messages"]
				}, function(err) {
					if (err)
						reject({
							operation: "Guild.dump()",
							message: err,
							path: ticketPath
						});
					
					// On success, provide the name of the file that was written
					resolve(file);
				});
			});
		}
	};
};