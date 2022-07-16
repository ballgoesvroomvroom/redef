// TO-DO: encrypt senstive fields such as passwords

const fs = require("fs");
const path = require("path");

const status = {
	"OK": 1,
	"ERROR": 0
}

class Repository {
	constructor(filename, autosave=600) {
		// absolute path to filename
		// autosave: seconds, saves local content to filename every autosave seconds
		this.filename = filename;
		this.status = status.ERROR; // status of 1 means 
		this.contents = {}; // store contents here

		try {
			fs.accessSync(this.filename, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.warn(err);
			fs.writeFileSync(this.filename, "{}");
		}

		this.status = status.OK;

		this.updateContents();
		this.updateIntervalId = setInterval(() => this.pushContents(), autosave *1000); // update every 600 seconds (10 minutes)
	}

	set autosave(newvalue) {
		// rewrite setInterval
		if (this.updateIntervalId != null) {
			clearInterval(this.updateIntervalId);
			this.updateIntervalId = null;
		}
		if (newvalue === -1) {
			// quit autosave; do nothing
		} else {
			this.updateIntervalId = setInterval(() => this.pushContents(), newvalue *1000);
		}
	}

	async updateContents() {
		// read the file and update .contents with the latest info
		if (this.status == status.ERROR) {
			console.warn("trying to update contents but repository failed");
			this.autosave = -1 // stop all current and future push operations
			return;
		}
		await fs.readFile(this.filename, "utf-8", (err, response) => {
			if (err) {
				console.log("trying to update contents", err);
				this.status = status.ERROR;
				return
			}
			console.log("read successfully");
			this.contents = JSON.parse(response);
			console.log(this.contents);
		});
	}

	async pushContents(res=null) {
		// use with promise resolve function (callback function)
		if (this.status == status.ERROR) {
			console.warn("trying to push contents but repository failed");
			clearInterval(this.updateIntervalId);
			if (res !== null) {res();} // resolve anyways; no clue what to add at this point in time
			return;
		}
		const data = JSON.stringify(this.contents, null, "\t");
		await fs.writeFile(this.filename, data, "utf-8", err => {
			if (err) {
				console.warn("trying to push contents", err);
				this.status = status.ERROR;
				return;
			}

			console.log("push successful for", this.filename);
			if (res !== null) {res();}
		});
	}

	doesUserExists(username) {
		// returns true if username exists in database
		return this.contents[username] != null;
	}

	getUserField(username, fieldName) {
		let d = this.contents[username];
		if (d != null) {
			return d[fieldName];
		}
		return null;
	}

	createField(key, value) {
		if (this.contents[key] != null) {
			// already exist
			return null; // don't override
		} else {
			// no entry for key yet in this.contents
			this.contents[key] = value;
			return true; // successful
		}
	}

	getBaseField(key) {
		return this.contents[key];
	}
}

module.exports = {
	user: new Repository(path.join(__dirname, "../../database/main.json")),
	server: new Repository(path.join(__dirname, "../../database/server.json"))
}