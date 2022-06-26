const baseURL = "/auth"; // base url for this router

const express = require("express");

const views = require("../views.js");
const sessions = require("../sessions.js");
const databaseinst = require("../../base/database.js");

const userDB = databaseinst.user;

const errmsg = require("../err_msgs.js");

const router = express.Router();
const SessionStore = sessions.SessionStore;

const cookieDelimiter = /; /g;
const cookieKeyValueSplit = /=/;

const parseCookie = (req, res, next) => {
	// sets headers.cookies = {"cookie1": "cookie1value", "cookie2": "cookie2value"}
	let headers = req.headers;

	if (headers.hasOwnProperty("cookie")) {
		let rawCookies = headers.cookie;
		let cookedCookies = {}

		rawCookies.split(cookieDelimiter).forEach(cookiePair => {
			var [key, value] = cookiePair.split(cookieKeyValueSplit);
			cookedCookies[key] = value;
		})

		headers.cookie = cookedCookies
	} else {
		headers.cookie = {};
	}

	next();
}

const baseSession = (req, res, next) => { // session id
	let headers = req.headers;

	// find SessionStore.cookieName header
	var sid;
	if (headers.hasOwnProperty("cookie") && headers.cookie.hasOwnProperty(SessionStore.cookieName)) {
		// ensure cookies exists in the first place
		sid = headers.cookie[SessionStore.cookieName];

		// validate if sid is valid\
		if (!SessionStore.valid(sid)) {
			// not valid; generate new sid
			sid = SessionStore.newClient();

			// set header
			res.set({"Set-Cookie": `${SessionStore.cookieName}=${sid}; path=/`});
		}
	} else { // create new session
		sid = SessionStore.newClient();

		// set header
		res.set({"Set-Cookie": `${SessionStore.cookieName}=${sid}; path=/`});
	}

	// attach session object to req
	req.session = SessionStore.getClient(sid);
	req.session.persist(); // reset TTL counter as user is active
	next();
}

const authenticated = (req, res, next) => { // actual authentication
	// validate if session object exists
	let sessionobj = req.session;
	if (sessionobj == null) {
		// maybe got timed out;
		// return a 400 error
		return router.status(400).end();
	}

	// check authentication status
	if (sessionobj.isAuthenticated) {
		next(); // authenticated
	} else {
		res.sendFile(views.login); // send login page
	}
}

router.post("/login", (req, res) => {
	// authenticate based on username and password (plain/text)
	let authSuccess = false;

	// validate input
	try {
		if (req.headers.hasOwnProperty("authorization")) {
			let creds = req.headers.authorization.split(":");
			
			if (creds.length != 2) {
				// not valid; username:password only; expected 2 values
				throw new Error(errmsg.invalid);
			}
			let [username, password] = creds;

			if (userDB.doesUserExists(username)) {
				// validate password
				if (password == userDB.getUserField(username, "password")) {
					req.session.username = username; // store username
					authSuccess = true;
				}
			}
		} else {
			throw new Error(errmsg.missing);
		}
	} catch (err) {
		res.statusMessage = err.message;
		res.status(400).json({"error": "Malformed input"});
	}

	if (authSuccess) {
		req.session.isAuthenticated = true;
		res.status(200).end();
	} else {
		// return 401
		// following spec
		res.set("WWW-Authenticate", `Basic realm="Site login"`);
		res.status(401).json({"error": "Invalid credentials"});
	}
})

module.exports = { // export router object and authenticated middleware
	baseURL, router, parseCookie, baseSession, authenticated
}