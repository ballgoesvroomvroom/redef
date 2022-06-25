// stores the paths for the different views
const path = require("path");

const root = process.cwd();
const html = path.join(root, "/public/html/")

class Views {
	static home = path.join(html, "base.html")
	static login = path.join(html, "views/login.html")
	static register = path.join(html, "views/register.html")

	static create = path.join(html, "views/create.html")
	static presets_create = path.join(html, "views/presets_create.html")

	static study = path.join(html, "views/study.html")
	static test = path.join(html, "views/questions.html")

	static settings = path.join(html, "views/settings.html")

	static notFound = path.join(html, "includes/404.html")
}

module.exports = Views;