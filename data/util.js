/* Tools and utilities
 */
// Converts a string to a number if it is valid hexadecimal
module.exports.stringToHex = function(h) {
	if (h === undefined)
		return undefined;
	
	let val = parseInt(h, 16);
	return (val.toString(16) === h ? val : undefined);
};

// Converts a number to a valid hexadecimal string
module.exports.toHexString = function(h) {
	if (h === undefined)
		return undefined;
	
	let str = h.toString(16);
	return (parseInt(str, 16) === h ? str : undefined);
};

// Generate a callback for fs.writeFile Promises
module.exports.writeFileCallback = function(operation, path, resolve, reject) {
	return function(err) {
		if (err)
			reject({
				operation: operation,
				message: err,
				path: path
			});
		
		resolve(path);
	};
};