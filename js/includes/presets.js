// responsible for most of the data manipulation/handling for preset data
const databaseinst = require("../base/database.js")

const userDB = databaseinst.user; // database containing user data

class Presets {
	static create(username, name, data) {
		// name - preset name
		var p = userDB.getUserField(username, "presets")
		p[name] = data;
	}

	static getData(username) {
		return userDB.getUserField(username, "presets")
	}

	static delete(username, name) {
		var success = delete userDB.getUserField(username, "presets")[name];
		return success
	}
}

module.exports = Presets;