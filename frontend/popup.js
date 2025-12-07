const manifest = chrome.runtime.getManifest();
const backendIP = manifest.env.BACKEND_API;

// --- 1. VIEW MANAGER ---
const viewLogin = document.getElementById("view-login");
const viewApp = document.getElementById("view-app");
const statusDiv = document.getElementById("status");
const userNameDisplay = document.getElementById("user-name");
document.addEventListener("DOMContentLoaded", async () => {
    const data = await chrome.storage.local.get(["pb_token", "pb_user"]);
    if (data.pb_token) {
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

document.getElementById("linkedinLogin").addEventListener("click", async () => {
    statusDiv.textContent = "Processing...";
    statusDiv.className = "";

    try {
        const authMethodsRes = await fetch(`${backendIP}/api/collections/users/auth-methods`);
        const authMethodsData = await authMethodsRes.json();
        
        const provider = authMethodsData.authProviders.find(p => p.name === "oidc");

        if (!provider) {
            throw new Error("LinkedIn provider not configured in PocketBase");
        }

        const redirectUri = chrome.identity.getRedirectURL(); 
        const authUrl = new URL(provider.authUrl);
        console.log(redirectUri)
        authUrl.searchParams.set("redirect_uri", redirectUri);
        
        chrome.identity.launchWebAuthFlow(
            {
                url: authUrl.toString(),
                interactive: true
            },
            async (responseUrl) => {
                if (chrome.runtime.lastError || !responseUrl) {
                    console.error(chrome.runtime.lastError);
                    statusDiv.textContent = "Login cancelled.";
                    statusDiv.className = "error";
                    return;
                }
                
                const urlObj = new URL(responseUrl);
                const code = urlObj.searchParams.get("code");
                
                if (!code) {
                    statusDiv.textContent = "No code received.";
                    statusDiv.className = "error";
                    return;
                }

                try {
                    statusDiv.textContent = "Verifying token...";
                    
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
                        throw new Error("Failed to exchange token");
                    }

                    const authData = await authResponse.json();
                    
                    // SAVE DATA
                    await chrome.storage.local.set({ 
                        pb_token: authData.token,
                        pb_user: authData.record 
                    });

                    // SUCCESS: SWITCH VI
                    showApp(authData.record);
                    
                } catch (err) {
                    console.error(err);
                    statusDiv.textContent = "Error: " + err.message;
                    statusDiv.className = "error";
                }
            }
        );

    } catch (error) {
        console.error(error);
        statusDiv.textContent = "Error: " + error.message;
        statusDiv.className = "error";
    }
});