// handles sessions

// CONSTANTS
const SESSION_TTL = 30; // minutes

// DEPENDANCIES
const crypto = require("crypto")

function randomBytes(size) {
	// shorthand function
	return crypto.randomBytes(size).toString("hex")
}

class SessionStore {
	cookieName = "filt"; // used to assign cookie name (session id)

	constructor() {
		this.clients = new Map();

		var store = this;
		this._cleanupID = setInterval(function() {
			store._cleanupOperation();
		}, 1000)
	}

	_cleanupOperation() {
		var timeNow = (new Date()).getTime();

		this.clients.forEach((clientObject, clientId) => {
			if (timeNow - clientObject._createdAt > SESSION_TTL *60 *1000) {
				this.destroyClient(clientId);
			}
		})
	}

	valid(clientId) {
		// wrapper
		return this.clients.has(clientId);
	}

	getClient(clientId) {
		// no need to validate for existence
		// will return undefined if no clientId exists anyways
		return this.clients.get(clientId);
	}

	newClient() {
		// construct a new client; returns the newly constructed client with its id
		let constructedClient = new Client();

		this.clients.set(constructedClient.id, constructedClient);
		return constructedClient.id;
	}

	destroyClient(clientId) {
		if (this.clients.has(clientId)) {
			// client exists
			this.clients.get(clientId).destroy(); // destroy client object
			this.clients.delete(clientId); // remove from memory
		}
	}
}

class Client {
	constructor() {
		this.id = randomBytes(16)
		this.isAuthenticated = false;

		// metadaata
		this._createdAt = (new Date()).getTime();
	}

	persist() {
		// reset timer
		this._createdAt = (new Date()).getTime();
	}

	destroy() {
		// place holder
		return;
	}
}

module.exports = {
	SessionStore: new SessionStore()
}