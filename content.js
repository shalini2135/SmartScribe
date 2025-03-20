// Modify content.js to capture selected text and send it for processing
document.addEventListener("mouseup", () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
      chrome.storage.local.set({ originalText: selectedText }, () => {
          chrome.runtime.sendMessage({ 
              action: "updatePopup",
              text: selectedText
          });
      });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelectedText") {
    chrome.storage.local.get("selectedText", (data) => {
      sendResponse({ text: data.selectedText || "" });
    });
    sendResponse({ success: true });
  }
});
