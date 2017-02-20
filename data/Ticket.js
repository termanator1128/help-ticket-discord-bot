var fs = require('fs'),
	path = require('path');

var util = require('./util.js');


/* Path information
 */
module.exports.ticketRoot = 'tickets/';
module.exports.ticketFile = 'info.json';
module.exports.messageRoot = 'messages/';


/* A Ticket made inside a Guild
 * 
 * Tickets are stored in ./{guildRoot}/{guildKey}/{ticketRoot}/
 * 	|--- {ticketFile}
 * 	|-.- {messageRoot}
 * 	  |--- {timestamp}.json
 */
// Constructor for a Ticket object
var Ticket = function(data, ticketPath, messagePath) {
	return {
		"id": data["id"],
		"author": data["author"],
		"open-timestamp": data["open-timestamp"],
		"close-timestamp": data["close-timestamp"],
		"message-count": data["message-count"],
		
		/* Ticket operations
		 */
		// Respond to this ticket
		respond: function(author, content, timestamp) {
			this["message-count"] += 1;
			
			return module.exports.Message(messagePath, {
				"author": {
					"id": author.id,
					"username": author.username
				},
				"created-on": timestamp,
				"history": [{
					"content": content,
					"timestamp": timestamp
				}]
			});
		},
		
		// Edit a response to this ticket
		editResponse: function(content, createdOn, timestamp) {
			return module.exports.editMessage(messagePath + createdOn + '.json', {
				"content": content,
				"timestamp": timestamp
			});
		},
		
		// Close this ticket
		close: function(author, content, timestamp) {
			var creator = this["author"];
			
			// Mark ticket as closed
			this["close-timestamp"] = timestamp;
			
			return [
				this.dump(),
				this.respond(author, content, timestamp),
				new Promise(function(resolve, reject) {
					if (!creator)
						reject("Unknown author");
					
					resolve(creator);
				})
			];
		},
		
		
		/* Saving information
		 */
		// Prepare a Promise to write this Ticket's data to a file
		dump: function() {
			// Pack data
			var data = {
					"id": this["id"],
					"author": this["author"],
					"open-timestamp": this["open-timestamp"],
					"close-timestamp": this["close-timestamp"],
					"message-count": this["message-count"]
				},
				// Construct path to destination file
				ticketFile = ticketPath + module.exports.ticketFile;
			
			return new Promise(function(resolve, reject) {
				fs.writeFile(ticketFile, JSON.stringify(data), util.writeFileCallback("Ticket.dump()", ticketPath, resolve, reject));
			});
		}
	}
};

// Open a Ticket
module.exports.openTicket = function(number, message, guildPath) {
	// Create a directory to house this Ticket
	var ticketPath = guildPath + module.exports.ticketRoot + number.toString(16);
	if (!fs.existsSync(ticketPath))
		fs.mkdirSync(ticketPath);
	ticketPath += '/';
	
	// Create a directory to house messages associated with this Ticket
	var messagePath = ticketPath + module.exports.messageRoot;
	if (!fs.existsSync(messagePath))
		fs.mkdirSync(messagePath);
	
	return Ticket({
		"id": number.toString(16),
		"author": {
			"id": message.author.id,
			"username": message.author.username
		},
		"open-timestamp": message.timestamp,
		"close-timestamp": -1,
		"message-count": 0,
	}, ticketPath, messagePath);
};

// Load a Ticket from a file
module.exports.loadTicket = function(filename) {
	var data = require(path.resolve(filename)),
		// Unpack path information from filename
		ticketPath = filename.substring(0, filename.indexOf(module.exports.ticketFile)),
		messagePath = ticketPath + module.exports.messageRoot;
	
	return Ticket(data, ticketPath, messagePath);
};


/* Messages are automatically written to file
 */
// Create a Promise for writing a Message
module.exports.Message = function(messagePath, data) {
	var file = messagePath + data["created-on"] + ".json";
	
	return new Promise(function(resolve, reject) {
		fs.writeFile(file, JSON.stringify(data), util.writeFileCallback("Write message", messagePath, resolve, reject));
	});
};

// Messages can be looked up by Ticket and creation time for editing
module.exports.editMessage = function(messagePath, editInfo) {
	// Load content at given path
	var message = require(messagePath);
	
	// Add data to message history
	message["history"].push(editInfo);
	
	// Write back to the file
	return new Promise(function(resolve, reject) {
		fs.writeFile(messagePath, JSON.stringify(message), util.writeFileCallback("Edit message", messagePath, resolve, reject));
	});
};