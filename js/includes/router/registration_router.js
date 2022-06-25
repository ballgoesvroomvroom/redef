const baseURL = "/register"; // base url for this router

const express = require("express");

const views = require("../views.js");
const User = require("../user.js")
const databaseinst = require("../../base/database.js");

const userDB = databaseinst.user;
const serverDB = databaseinst.server;

const router = express.Router();

// FOR REGISTRATION VALIDATION

router.post("/vu", (req, res) => {
	// verify username
	let username = req.body.username;

	if (username == null) {
		return res.status(400).json({"error": "body.username missing"});
	}

	if (userDB.doesUserExists(username)) {
		return res.status(400).end();
	} else {
		return res.status(200).end();
	}
})

router.post("/vlk", (req, res) => {
	// verify license key
	let key = req.body.licenseKey;

	if (key == null) {
		return res.status(400).json({"error": "body.licenseKey missing"});
	}

	let keys = serverDB.getBaseField("keys");
	if (keys[key] != null && keys[key][0] === false) {
		return res.status(200).end();
	} else {
		return res.status(400).end();
	}
})

// REGISTRATION VALIDATION END

// PAGE
router.get("/", (req, res) => {
	res.type("html");
	res.sendFile(views.register);
})

// ACTUAL REGISTRATION
router.post("/action", (req, res) => {
	let username = req.body.username;
	let password = req.body.password;
	let licenseKey = req.body.licenseKey;

	if (username == null) {
		res.status(400).json({"error": "body.username missing"});
	} else if (password == null) {
		res.status(400).json({"error": "body.password missing"});
	} else if (licenseKey == null) {
		res.status(400).json({"error": "body.licenseKey missing"});
	}

	let keys = serverDB.getBaseField("keys");
	try {
		if (keys[licenseKey] != null && keys[licenseKey][0] == false) {
			// keys["licenseKeyHere"] = [isTaken, usernameRegistered]; // usernameRegistered will store an empty string if isTaken is false

			// construct new user object
			let userData = new User(username, password);

			// write userData to database; will validate internally
			var success = userData.write()
			if (success) {
				keys[licenseKey] = [true, username]; // occupy key

				res.status(200).json({}); // return back expected empty array object
			} else {
				res.status(400).json({"error": "failed to create new entry in database"});
			}
		} else {
			// invalid license key
			res.status(401).end();
		}
	} catch (err) {
		// invalid key passed (might have been used key[0] = true)
		res.status(401).end();
	}
})
// END OF ACTUAL REGISTRATION


module.exports = {
	baseURL, router
}