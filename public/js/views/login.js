const usernamefriendly = /^[a-zA-Z\d]*$/;

$.fn.isValid = function() {
	return this[0].checkValidity();
}

$(document).ready(function(e) {
	// clear sessionStorage; possibly redirected from /logout
	localStorage.clear();
	sessionStorage.clear();

	const $form = $("#interface-card")
	const $usernameInput = $("#usernameInput");
	const $passwordInput = $("#passwordInput");
	const $submit = $("#proceed");

	const $submitText = $("#submitButtonText");
	const $submitLoader = $("#submitLoader")

	const $registerButton = $("#registerButton")

	const showMap = ["none", "block"]; // maps boolean value to corresponding style values
	function showSubmitSpinner(toShow) {
		// toShow: boolean; whether to show spinner or not
		$submitText.css("style", showMap[!toShow]);
		$submitLoader.css("style", showMap[toShow]);
	}

	var processing = false; // debounce value; sort-of
	$form.on("submit", (e) => {
		// submit event
		if (processing) return; // debounce; don't allow double clicks

		processing = true;
		e.preventDefault();
		e.stopPropagation();
		// var isUserValid = $usernameInput.isValid();
		// var isPassValid = $passwordInput.isValid();

		// effects
		showSubmitSpinner(true);

		var isFormValid = $form.isValid();
		if (isFormValid) {
			// valid forms
			// send fetch signal
			fetch("/api/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					username: $usernameInput.val(),
					password: $passwordInput.val()
				})
			}).then(res => {
				if (res.status == 200) {
					// valid
					return res.json();
				} else {
					// server invalidated request
					throw Error(JSON.stringify(res.json().error));
				}
			}).then(res => {
				// res contains the token; res.Token
				// localStorage.setItem("token", res.Token);
				showSubmitSpinner(false);
				processing = false; // reset debounce state

				// success, redirect user again
				window.location.replace(window.location.pathname === "/logout" ? "/" : window.location.pathname); // redirect to same page; but no "/logout" path
			}).catch(errMsg => {
				showSubmitSpinner(false);
				processing = false; // reset debounce state
			})
		} else {
			processing = false;
			showSubmitSpinner(false);
		}
	})

	$registerButton.on("click", (e) => {
		// redirect to register page
		window.location.href = "/register";
	})
})