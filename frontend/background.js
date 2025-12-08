const manifest = chrome.runtime.getManifest();
const backendIP = manifest.env.BACKEND_API;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    if (request.action === "linkedin_login") {
    handleLogin().then((data) => {
      sendResponse({ success: true, user: data });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; 
  }
});
async function isUserLoggedIn() {
    const data = await chrome.storage.local.get("linkedin_access_token");
    if (!data.linkedin_access_token) return false;

    return true;
}
async function handleLogin() {

  try {
    const authMethodsRes = await fetch(`${backendIP}/api/collections/users/auth-methods`);
    const authMethodsData = await authMethodsRes.json();
    
    const provider = authMethodsData.authProviders.find(p => p.name === "oidc");
    
    if (!provider) {
      throw new Error("LinkedIn (OIDC) provider not configured in PocketBase");
    }

    const redirectUri = chrome.identity.getRedirectURL(); 
    const authUrl = new URL(provider.authUrl);
    authUrl.searchParams.set("redirect_uri", redirectUri);

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    if (chrome.runtime.lastError || !responseUrl) {
      throw new Error(chrome.runtime.lastError?.message || "Login cancelled");
    }

    const urlObj = new URL(responseUrl);
    const code = urlObj.searchParams.get("code");
    
    if (!code) throw new Error("No code received from provider");

    const authResponse = await fetch(
      `${backendIP}/api/collections/users/auth-with-oauth2`, 
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "oidc", 
          code: code,
          codeVerifier: provider.codeVerifier,
          redirectUrl: redirectUri 
        })
      }
    );

    if (!authResponse.ok) {
      throw new Error("Failed to exchange token with PocketBase");
    }

    const authData = await authResponse.json();
    await chrome.storage.local.set({ 
      pb_token: authData.token,
      pb_user: authData.record 
    });

    return authData.record;

  } catch (error) {
    console.error("Background Login Error:", error);
    throw error;
  }
}