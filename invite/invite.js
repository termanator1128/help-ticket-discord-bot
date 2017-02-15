/* Generates an invite link given the bot's information and a list of permissions
 */ 
module.exports.invite = function(clientId, permissions) {
	return `https://discordapp.com/api/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=${require('./permissions.js')(permissions)}`;
};