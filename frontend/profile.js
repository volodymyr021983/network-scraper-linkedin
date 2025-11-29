chrome.storage.local.get("candidate_profile", (result) => {
    const data = result.candidate_profile;

    if (!data) {
        document.body.innerHTML = "<p>No profile data found.</p>";
        return;
    }

    document.getElementById("photo").src = data.img_url || "";
    document.getElementById("location").textContent = data.location || "";
    document.getElementById("overview").textContent = data.overview || "";

    const skillsList = document.getElementById("skills");
    (data.key_skills || []).forEach(skill => {
        let li = document.createElement("li");
        li.textContent = skill;
        skillsList.appendChild(li);
    });

    let link = document.getElementById("linkedin");
    link.href = data.url || "#";
    chrome.storage.local.remove("candidate_profile");
});
