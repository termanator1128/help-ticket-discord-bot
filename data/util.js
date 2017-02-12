/* Tools and utilities
 */
// Converts a string to a number if it is valid hexadecimal
module.exports.toHex = function(h) {
	let val = parseInt(h, 16);
	return (val.toString(16) === h ? val : undefined);
};