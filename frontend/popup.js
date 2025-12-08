const viewLogin = document.getElementById("view-login");
const viewApp = document.getElementById("view-app");
const statusDiv = document.getElementById("status");
const userNameDisplay = document.getElementById("user-name");

document.addEventListener("DOMContentLoaded", async () => {
    const data = await chrome.storage.local.get(["pb_token", "pb_user"]);
    if (data.pb_token && data.pb_user) {
        showApp(data.pb_user);
    } else {
        showLogin();
    }
});

function showApp(user) {
    viewLogin.classList.add("hidden");
    viewApp.classList.remove("hidden");
    if(user && user.name) {
        userNameDisplay.textContent = "Hi, " + user.name.split(' ')[0];
    }
}

function showLogin() {
    viewApp.classList.add("hidden");
    viewLogin.classList.remove("hidden");
    statusDiv.textContent = "";
    statusDiv.className = "";
}

document.getElementById("btnLogout").addEventListener("click", () => {
    chrome.storage.local.remove(["pb_token", "pb_user"], () => {
        showLogin();
    });
});
document.getElementById("linkedinLogin").addEventListener("click", () => {
    statusDiv.textContent = "Processing... Check the popup window.";
    statusDiv.className = "";

    chrome.runtime.sendMessage({ action: "linkedin_login" }, (response) => {
        
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            statusDiv.textContent = "Error connecting to extension background.";
            statusDiv.className = "error";
            return;
        }

        if (response && response.success) {
            showApp(response.user);
        } else if (response && !response.success) {
            statusDiv.textContent = "Error: " + response.error;
            statusDiv.className = "error";
        }
    });
});