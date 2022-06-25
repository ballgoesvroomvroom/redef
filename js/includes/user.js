// MODEL FOR A USER OBJECT

const databaseinst = require("../base/database.js");

const userDB = databaseinst.user;
const serverDB = databaseinst.server;

const username_test = /[a-zA-Z]{5,25}/gm;
const password_test = /[a-zA-Z\d!@#$%^&*()\-]{6,25}/gm;

class User {
	constructor(username, password) {
		this.username = username;
		this.data = {
			password: password,
			tests: [],
			words: {},
			presets: {},
			metadata: {
				wordsLastUpdated: 1,
				testsLastUpdated: 1,
				testsCreated: 0
			},
			preferences: {
				wordsCaseSens: false,
				chaptersCaseSens: false,
				enableRegexCapturing: true,
				randomOrder: false
			}
		}

		this.validated = false;
	}

	validate() {
		// validate username
		if (this.username.length < 5 || this.username.length > 25) {
			// either too short or too long
			return false;
		} else if (userDB.doesUserExists(this.username)) {
			// name exists
			return false;
		} else if (!username_test.test(this.username)) {
			// failed regex validation
			return false;
		}

		// validate password
		if (this.data.password.length < 6 || this.data.password.length > 25) {
			// either too short or too long
			return false;
		} else if (!password_test.test(this.data.password)) {
			return false;
		}

		this.validated = true;
		return true;
	}

	write() {
		// write into userDB;
		// if failed to write; returns false
		// returns true on a successful operation
		if (!this.validated) {
			if (!this.validate()) {
				// failed to validate fields
				return false;
			}
		}

		return userDB.createField(
			this.username,
			this.data
		)
	}
}

module.exports = User;