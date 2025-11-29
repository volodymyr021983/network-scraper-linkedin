chrome.storage.local.get("pb_token", (data) => {
    
    if (!data.pb_token) {
        console.warn("Parser Aborted: User is not logged in.");
        return; 
    }
    (async function Content() {
        const url = window.location.href;
        
        // utils
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        const getText = (selector, parent = document) => {
            const el = parent.querySelector(selector);
            return el ? el.innerText.trim() : "";
        };

        // actions
        async function autoScroll() {
            const distance = 300;
            const delay = 80;
            // scroll down
            while ((window.innerHeight + window.scrollY) < document.body.offsetHeight) {
                window.scrollBy(0, distance);
                await sleep(delay);
            }
            // then ensure we are ready
            window.scrollTo(0, 0);
            await sleep(500);
        }

        // EXTRACTION LOGIC
        function scrapeHeader() {
            const name = getText('section[data-member-id] h1');
            const img_url = document.querySelector(`img[title*="${name}"]`).src;
            const title = getText('section[data-member-id] div.mt2.relative div div.text-body-medium');
            const location = getText('section[data-member-id] div.mt2.relative div.mt2 span.text-body-small');
            return { name, title, location, img_url };
        }

        function scrapeAbout() {
            const section = document.querySelector('#about');
            if (!section) return "";
            const textDiv = section.parentElement.querySelector("div.ph5.pv3 span[aria-hidden='true']");
            return textDiv ? textDiv.innerText.trim() : "";
        }

        async function scrapeExperience() {
            const section = document.querySelector('#experience');
            if (!section) return [];

            const anchor = section.closest('section');
            const items = anchor ? anchor.querySelectorAll('li.artdeco-list__item') : [];

            console.log(`found ${items.length} experience entries.`);

            let results = [];

            for (const item of items) {
                const roleNode = item.querySelector('div.display-flex.align-items-center span[aria-hidden="true"]');
                const infoNode = [...item.querySelectorAll('span.t-14.t-normal span[aria-hidden="true"]')].map(n => n.innerText.trim());

                let entry = {
                    role: roleNode ? roleNode.innerText.trim() : "",
                    info: infoNode,
                    skills: []
                };

                const skillsLink = item.querySelector('a[data-field="position_contextual_skills_see_details"]');

                if (skillsLink) {
                    try {
                        skillsLink.scrollIntoView({ block: "center" });
                        await sleep(500);
                        skillsLink.click();

                        await sleep(2000); // wait for modal

                        entry.skills = getSkillsFromModal();

                        const closeBtn = document.querySelector('button[aria-label="Dismiss"]');
                        if (closeBtn) {
                            closeBtn.click();
                            await sleep(1000);
                        }
                    } catch (e) {
                        console.warn("failed to open/close skills modal:", e);
                    }
                }
                results.push(entry);
            }
            return results;
        }

        function getSkillsFromModal() {
            const modal = document.querySelector('.artdeco-modal[role="dialog"]');
            if (!modal) return [];

            const nodes = modal.querySelectorAll('li li.artdeco-list__item span[aria-hidden="true"]');

            const skills = Array.from(nodes).map(n => n.innerText.trim()).filter(t => t.length > 1 && !t.includes("Skills:"));

            return [...new Set(skills)];
        }

        // EXECUTION FLOW
        await autoScroll();
        
        const header = scrapeHeader();
        const about = scrapeAbout();
        const experience = await scrapeExperience();
        const finalProfile = {
            ...header,
            about,
            experience,
            url
        };
        console.log(finalProfile);

        // send message to background (Token is implicitly verified by the fact we are running)
        chrome.runtime.sendMessage({ 
            action: "user_profile", 
            payload: finalProfile 
        });

    })(); 
});