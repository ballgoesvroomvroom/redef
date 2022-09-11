const baseURL = "/";

const express = require("express");
const crypto = require("crypto");

const auth_router = require("./auth_router.js");
const views = require("../views.js");
const databaseinst = require("../../base/database.js");

const userDB = databaseinst.user;
const serverDB = databaseinst.server;

const Tests = require("../tests.js");

const errmsg = require("../err_msgs.js");

const router = express.Router();

router.use(auth_router.authenticated); // authenticated calls only

// HOME PAGE
router.get("/", (req, res) => {
	res.type("html");
	res.sendFile(views.home);
})

// LOGIN ALIAS
router.get("/login", (req, res) => {
	res.redirect("/");
})

// LOGOUT
router.get("/logout", (req, res) => {
	req.session.isAuthenticated = false; // reset state
	res.redirect("/");
})

// CREATE TESTS
router.get("/create", (req, res) => {
	res.type("html");
	res.sendFile(views.create);
})

// CREATE PRESETS
router.get("/presets/create", (req, res) => {
	res.type("html");
	res.sendFile(views.presets_create)
})

// STUDY PAGE
router.get("/study", (req, res) => {
	res.type("html");
	res.sendFile(views.study)
})

// SETTINGS PAGE
router.get("/settings", (req, res) => {
	res.type("html");
	res.sendFile(views.settings);
})

// GLOBAL TEST PAGE
router.get("/test/g/:id", (req, res) => {
	res.status(501).send("endpoint is still work in progress"); // yet to implement
})

// LOCAL TEST PAGE
router.get("/test/l/:id", (req, res, next) => {
	let requestedID = req.params.id;

	if (isNaN(requestedID)) {
		res.statusMessage = errmsg.type;
		res.status(400).end();
	}

	if (Tests.getTestFromId(req.session.username, requestedID)) {
		res.type("html");
		res.sendFile(views.test);
	} else {
		res.status(404);
		next();
		// don't end it, let last middleware handle this 404 error
	}
})

// SECRET CREATE PATHS
router.get("/secret-upload-path", (req, res) => {
	if (req.session.username === "admin") {
		let keys = serverDB.getBaseField("keys");
		while (true) {
			// generate a random hex string of 30 characters; 1 byte - 2 hex characters
			var r = crypto.randomBytes(15).toString("hex");
			if (keys[r] == null) {
				// generated string doesn't exist in keys table
				keys[r] = [false, ""]; // add it into the server database
				return res.json({"key": r});
			} else {
				// duplicate; do nothing; regenerate key
			}
		}
	} else {
		return res.status(403).end();
	}
})

// SECRET GET PATH
router.get("/secret-get-path", (req, res) => {
	if (req.session.username === "admin") {
		let keys = serverDB.getBaseField("keys");
		res.type("json");
		res.json(keys);
	} else {
		res.status(403).end();
	}
})

// FLASHTABS EXPORT PAGE
router.get("/flashtabs", (req, res) => {
	res.type("html");
	res.sendFile(views.flashtabs_export);
})

// FLASHTABS EXPORT PAGE (ALIAS)
router.get("/flashtab", (req, res) => {
	res.redirect("/flashtabs")
})

module.exports = {
	baseURL, router
}