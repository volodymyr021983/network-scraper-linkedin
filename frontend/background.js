chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const manifest = chrome.runtime.getManifest();
    const backendIP = manifest.env.BACKEND_API;
    if (request.action === "add_candidate") {
        chrome.storage.local.get("pb_token", (data) => {
            if (!data.pb_token) {
                console.warn("Unauthorized: Attempted to parse profile without login.");
                sendResponse({ success: false, error: "unauthorized" });
                return;
            }
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            files: ['parser.js']
                        }).then(() => {
                                console.log("Parser injected successfully");
                                sendResponse({ success: true });
                            }).catch((err) => {
                                console.error("Script injection failed", err);
                                sendResponse({ success: false, error: err.message });
                            });
            });
        });
        return true;
    }
    if (request.action === "user_profile") {
        chrome.storage.local.get("pb_token", (data) => {
            const token = data.pb_token;
            if (!token) {
                console.error("Security Alert: User attempted action without being logged in.");
                return;
            }
            fetch(`${backendIP}/CreateCandidate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ payload: request.payload })
            }).then(response => {
                    if (!response.ok) {
                        if (response.status === 401) {
                            console.error("Token expired or invalid.");
                            chrome.storage.local.remove("pb_token");
                        }
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                }).then(responseData => {
                    chrome.storage.local.set({ candidate_profile: responseData }, () => {
                    chrome.windows.create({
                        url: chrome.runtime.getURL("profile.html"),
                        type: "popup",
                        width: 400,
                        height: 600
                    });
                    
                });
                }).catch(error => {
                    console.error("Fetch failed:", error);
                });
        });
        return true;
    }
    if (request.action === "check_auth_status") {
        isUserLoggedIn().then((isLoggedIn) => {
            sendResponse({ isLoggedIn: isLoggedIn });
        });
        return true;
    }
});
async function isUserLoggedIn() {
    const data = await chrome.storage.local.get("linkedin_access_token");
    if (!data.linkedin_access_token) return false;

    return true;
}