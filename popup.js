document.getElementById('captureBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const host = location.hostname;
        let messages = [];
        // ChatGPT messages use data-message-author-role to identify roles explicitly.
        if (host.includes('chat.openai.com') || host.includes('chatgpt.com')) {
          messages = [...document.querySelectorAll('div[data-message-author-role]')].map(el => ({
            role: el.getAttribute('data-message-author-role'),
            text: el.innerText.trim(),
            timestamp: Date.now()
          }));
        } else if (host.includes('gemini.google.com') || host.includes('bard.google.com') || host.includes('g.co')) {
          // Gemini/Bard: attempt to extract messages from chat-history or data-message-id.
          let nodes = document.querySelectorAll('#chat-history > infinite-scroller > div');
          if (nodes.length === 0) {
            nodes = document.querySelectorAll('div[data-message-id]');
          }
          if (nodes.length === 0) {
            nodes = document.querySelectorAll('p[data-sourcepos]');
          }
          nodes.forEach((node, index) => {
            const text = node.innerText.trim();
            if (!text) return;
            const role = index % 2 === 0 ? 'user' : 'assistant';
            messages.push({ role, text, timestamp: Date.now() });
          });
        }
        chrome.storage.local.set({ lastSession: messages });
      }
    }, () => {
      // Give the script time to write to storage, then reload the session in the popup.
      setTimeout(loadSession, 500);
    });
  });
});

function loadSession() {
  chrome.storage.local.get("lastSession", (data) => {
    const container = document.getElementById("output");
    container.innerHTML = "";
    if (!data.lastSession || data.lastSession.length === 0) {
      container.innerText = "Aucune conversation capturée.";
      return;
    }

    data.lastSession.forEach((msg) => {
      const p = document.createElement("p");
      p.innerText = `[${msg.role}] ${msg.text}`;
      container.appendChild(p);
    });
  });
}

loadSession();

document.getElementById("copyBtn").addEventListener("click", () => {
  chrome.storage.local.get("lastSession", (data) => {
    if (!data.lastSession || data.lastSession.length === 0) {
      alert("Aucune conversation à copier.");
      return;
    }

    const text = data.lastSession
      .map((msg) => `[${msg.role}] ${msg.text}`)
      .join("\n\n");

    navigator.clipboard.writeText(text).then(() => {
      alert("Conversation copiée dans le presse-papiers !");
    }, (err) => {
      console.error("Erreur de copie :", err);
    });
  });
});
