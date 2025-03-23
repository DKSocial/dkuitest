document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;

    if (localStorage.getItem("darkMode") === "enabled") {
        body.classList.add("dark-mode");
    }

    const enableButton = document.getElementById("enable-dark");
    const disableButton = document.getElementById("disable-dark");

    if (enableButton) {
        enableButton.addEventListener("click", () => {
            localStorage.setItem("darkMode", "enabled");
            body.classList.add("dark-mode");
        });
    }

    if (disableButton) {
        disableButton.addEventListener("click", () => {
            localStorage.setItem("darkMode", "disabled");
            body.classList.remove("dark-mode");
        });
    }
});
