// This content script runs in both ChatGPT and Gemini/Bard contexts. It monitors
// the DOM for new messages and extracts the chat history into chrome.storage.local.
// For ChatGPT, messages are marked with the data-message-author-role attribute.
// For Gemini/Bard, there are no stable role attributes on message containers, so
// we infer roles based on the order of messages. When available, the data-message-id
// attribute is used to locate message elements; otherwise we fall back to
// paragraphs with data-sourcepos, which appear on shared conversation pages.

function waitForMessagesAndExtract() {
  // Delay extraction until at least one assistant message appears (ChatGPT), or
  // until the chat-history element exists (Gemini/Bard).
  if (isGemini()) {
    const chatHistory = document.querySelector('#chat-history');
    if (!chatHistory) {
      console.log('⌛ En attente de #chat-history...');
      setTimeout(waitForMessagesAndExtract, 1000);
      return;
    }
  } else {
    const assistantMessages = document.querySelectorAll('div[data-message-author-role="assistant"]');
    if (assistantMessages.length === 0) {
      console.log('⌛ En attente de messages...');
      setTimeout(waitForMessagesAndExtract, 1000);
      return;
    }
  }
  extractChatData();
}

function isGemini() {
  const host = location.hostname;
  return host.includes('gemini.google.com') || host.includes('bard.google.com') || host.includes('g.co');
}

function extractChatData() {
  const session = [];
  if (isGemini()) {
    // Try to capture messages from Gemini/Bard.
    let messageNodes = document.querySelectorAll('#chat-history > infinite-scroller > div');
    if (messageNodes.length === 0) {
      // On some pages (shared conversations) messages may be rendered as divs
      // with data-message-id or simple paragraphs. Attempt to select those.
      messageNodes = document.querySelectorAll('div[data-message-id]');
    }
    if (messageNodes.length === 0) {
      messageNodes = document.querySelectorAll('p[data-sourcepos]');
    }
    messageNodes.forEach((node, index) => {
      let text = node.innerText.trim();
      if (!text) return;
      // Determine role: assume the first message is from the user and alternate.
      const role = index % 2 === 0 ? 'user' : 'assistant';
      session.push({
        role,
        text,
        timestamp: Date.now()
      });
    });
  } else {
    // ChatGPT conversation extraction using explicit roles
    const userMessages = document.querySelectorAll('div[data-message-author-role="user"]');
    const assistantMessages = document.querySelectorAll('div[data-message-author-role="assistant"]');
    userMessages.forEach(el => {
      const text = el.innerText.trim();
      if (!text) return;
      session.push({
        role: 'user',
        text,
        timestamp: Date.now()
      });
    });
    assistantMessages.forEach(el => {
      const text = el.innerText.trim();
      if (!text) return;
      session.push({
        role: 'assistant',
        text,
        timestamp: Date.now()
      });
    });
  }
  if (session.length > 0) {
    chrome.storage.local.set({ lastSession: session }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Erreur stockage :', chrome.runtime.lastError);
      } else {
        console.log('✅ Session enregistrée :', session);
      }
    });
  } else {
    console.log('❌ Aucun message détecté.');
  }
}

// Monitor DOM mutations so new messages are captured automatically.
const observer = new MutationObserver(() => {
  extractChatData();
});

observer.observe(document.body, { childList: true, subtree: true });

waitForMessagesAndExtract();