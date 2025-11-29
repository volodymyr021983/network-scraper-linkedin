let injectionInterval = null;

function addCandidateButton() {
    const profiles = document.querySelectorAll('div[data-view-name="cohort-card"]');
    
    profiles.forEach(profile => {
        if (!profile.querySelector('.my-candidate-btn')) {
            
            const btn = document.createElement('button');
            btn.innerText = 'Add Candidate';
            btn.className = 'my-candidate-btn'; 
            
            btn.onclick = (e) => {
                e.preventDefault(); 
                e.stopPropagation();

                chrome.storage.local.get("pb_token", (data) => {
                    if (data.pb_token) {
                        const linkTag = profile.querySelector('a');
                        const link = linkTag ? linkTag.href : window.location.href;
                        
                        chrome.runtime.sendMessage({ 
                            action: "send_link_data", 
                            payload: link,
                            token: data.pb_token 
                        });
                        
                        btn.innerText = "Saved!";
                        setTimeout(() => btn.innerText = "Add Candidate", 2000);
                    } else {
                        alert("Please log in to the extension first.");
                    }
                });
            };

            profile.appendChild(btn);
        }
    });
}

function removeCandidateButtons() {
    const buttons = document.querySelectorAll('.my-candidate-btn');
    buttons.forEach(btn => btn.remove());
}

function handleAuthState(isLoggedIn) {
    if (isLoggedIn) {
        if (!injectionInterval) {
            addCandidateButton(); 
            injectionInterval = setInterval(addCandidateButton, 2000);
        }
    } else {
        if (injectionInterval) {
            clearInterval(injectionInterval);
            injectionInterval = null;
        }
        removeCandidateButtons();
    }
}

//check status immediately on page load
chrome.storage.local.get("pb_token", (data) => {
    handleAuthState(!!data.pb_token);
});

//listen for Login/Logout events from Popup
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.pb_token) {
        const hasToken = !!changes.pb_token.newValue;
        handleAuthState(hasToken);
    }
});
