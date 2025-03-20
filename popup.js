// Modify popup.js to include YouTube link functionality
function debounce(func, delay = 300) {
  let timer;
  return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  window.jsPDF = window.jspdf.jsPDF;
  initPopup();
});

function initPopup() {
  const margin = 10;
  const elements = {
    generateNotesButton: document.getElementById("generateNotesButton"),
    userInput: document.getElementById("userInput"),
    questionsArea: document.getElementById("questionsArea"),
    notesArea: document.getElementById("notesArea"),
    youtubeLink: document.getElementById("youtubeLink"), // New Element
    downloadButton: document.getElementById("downloadButton"),
    historyList: document.getElementById("historyList"),
    clearHistory: document.getElementById("clearHistory")
  };

  // Load stored data
  chrome.storage.local.get(["originalText", "questionsAnswers", "revisionNotes", "youtubeUrls", "history"], (data) => {
    elements.userInput.value = data.originalText || "";
    elements.questionsArea.textContent = data.questionsAnswers || "No questions generated yet";
    elements.notesArea.textContent = data.revisionNotes || "No notes generated yet";
    if (data.youtubeUrls && data.youtubeUrls.length > 0) {
      elements.youtubeLink.innerHTML = data.youtubeUrls.map(url =>
          `<div><a href="${url}" target="_blank">Watch Related Video</a></div>`
      ).join('');
  }
    displayHistory(data.history || []);
  });

  function displayHistory(history) {
    elements.historyList.innerHTML = history
      .map((entry, index) => `
        <div class="history-item" data-index="${index}">
          <small>${new Date(entry.timestamp).toLocaleString()}</small>
          <div class="history-preview">${entry.text.substring(0, 50)}...</div>
        </div>
      `).join('');
  }
  // History click handler
  elements.historyList.addEventListener("click", (e) => {
    const item = e.target.closest(".history-item");
    if (!item) return;

    const entryIndex = parseInt(item.dataset.index, 10);
    chrome.storage.local.get(["history"], ({ history = [] }) => {
        const entry = history[entryIndex];
        if (entry) {
            elements.userInput.value = entry.text;
            elements.questionsArea.textContent = entry.questions || "No questions available.";
            elements.notesArea.textContent = entry.notes || "No notes available.";
        } else {
            console.warn("History entry not found or index mismatch.");
        }
    });
});

  

  // Clear history
  elements.clearHistory.addEventListener("click", () => {
    chrome.storage.local.set({ history: [] }, () => {
      elements.historyList.innerHTML = "";
      elements.userInput.value = "";
      elements.questionsArea.textContent = "History cleared.";
      elements.notesArea.textContent = "";
    });
  });
  

  // Generate handler
// Generate handler with improved logic
elements.generateNotesButton.addEventListener("click", debounce(async () => {
  const text = elements.userInput.value.trim();
  if (!text) {
      elements.questionsArea.textContent = "Please enter or select some text first!";
      return;
  }

  elements.questionsArea.textContent = "Generating... 🚀";
  elements.notesArea.textContent = "Generating... 🚀";

  chrome.runtime.sendMessage(
      { action: "generateNotes", text },  // Pass text directly
      (response) => {
          if (response?.error) {
              elements.questionsArea.textContent = `❌ Error: ${response.error}`;
              elements.notesArea.textContent = "";
          } else {
              elements.questionsArea.textContent = response.questionsAnswers;
              elements.notesArea.textContent = response.revisionNotes;

              // Display multiple YouTube links correctly
              if (response.youtubeUrls && response.youtubeUrls.length > 0) {
                  elements.youtubeLink.innerHTML = response.youtubeUrls.map(url =>
                      `<div><a href="${url}" target="_blank">${url}</a></div>`
                  ).join('');
              } else {
                  elements.youtubeLink.innerHTML = "No related videos found.";
              }

              chrome.storage.local.set({
                  questionsAnswers: response.questionsAnswers,
                  revisionNotes: response.revisionNotes,
                  originalText: text,
                  youtubeUrls: response.youtubeUrls
              });

              // Update history
              chrome.storage.local.get(["history"], async ({ history = [] }) => {
                  const newEntry = {
                      id: Date.now(), // Unique ID for each entry
                      text,
                      questions: response.questionsAnswers,
                      notes: response.revisionNotes,
                      timestamp: Date.now()
                  };
                  
                  const updatedHistory = [newEntry, ...history].slice(0, 10);
              
                  await chrome.storage.local.set({ history: updatedHistory }, () => {
                      displayHistory(updatedHistory);
                  });
              });
          }
      }
  );
}));


  // PDF Download handler
  elements.downloadButton.addEventListener("click", () => {
    chrome.storage.local.get(["originalText", "questionsAnswers", "revisionNotes", "youtubeUrls"], (data) => {
        if (!data.questionsAnswers && !data.revisionNotes) {
            elements.questionsArea.textContent = "⚠️ Generate content first!";
            return;
        }

        try {
            const doc = new window.jspdf.jsPDF();
            let yPos = 10;
            const margin = 10;
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            const maxWidth = pageWidth - (margin * 2);

            const cleanText = (text) => {
                return text.replace(/\*\*(.*?)\*\*/g, '- $1'); // Replace ** with "-"
            };

            if (data.originalText) {
                yPos = addSection(doc, "Original Text", cleanText(data.originalText), yPos, 11, margin, maxWidth);
            }

            if (data.questionsAnswers) {
                yPos = addSection(doc, "Practice Questions & Answers", cleanText(data.questionsAnswers), yPos, 12, margin, maxWidth);
            }

            if (data.revisionNotes) {
                yPos = addSection(doc, "Quick Revision Notes", cleanText(data.revisionNotes), yPos, 12, margin, maxWidth);
            }

            if (data.youtubeUrls) {
                doc.setFontSize(12);
                doc.text("Related YouTube Links:", margin, yPos);
                yPos += 10;

                data.youtubeUrls.forEach((url) => {
                    if (yPos > pageHeight - 20) {
                        doc.addPage();
                        yPos = 10;
                    }
                    doc.textWithLink(url, margin, yPos, { url });
                    yPos += 10;
                });
            }

            let userFilename = prompt("Enter a name for the PDF file:", "Study_Materials");
            if (!userFilename) userFilename = "Study_Materials";
            userFilename = userFilename.replace(/[^\w\s]/gi, '').trim().replace(/\s+/g, "_");

            doc.save(`${userFilename}.pdf`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
        }
    });
});

// Function to maintain alignment and layout
function addSection(doc, title, content, yPos, fontSize, margin, maxWidth) {
    doc.setFontSize(14);
    doc.setTextColor(40, 53, 147);
    doc.text(title, margin, yPos);
    yPos += 8;

    doc.setFontSize(fontSize);
    doc.setTextColor(0);

    const lines = doc.splitTextToSize(content, maxWidth);

    lines.forEach(line => {
        if (yPos > 280) {
            doc.addPage();
            yPos = 10;
        }
        doc.text(line, margin, yPos);
        yPos += 7;
    });

    return yPos + 15;
}


// Function to maintain the same alignment and styling
function addSection(doc, title, content, yPos, fontSize, margin, maxWidth) {
    doc.setFontSize(14);
    doc.setTextColor(40, 53, 147);
    doc.text(title, margin, yPos);
    yPos += 8;

    doc.setFontSize(fontSize);
    doc.setTextColor(0);

    const lines = doc.splitTextToSize(content, maxWidth);

    lines.forEach(line => {
        if (yPos > 280) {
            doc.addPage();
            yPos = 10;
        }
        doc.text(line, margin, yPos);
        yPos += 7;
    });

    return yPos + 15;
}


// Function to maintain the same alignment and styling
function addSection(doc, title, content, yPos, fontSize, margin, maxWidth) {
    doc.setFontSize(14);
    doc.setTextColor(40, 53, 147);
    doc.text(title, margin, yPos);
    yPos += 8;

    doc.setFontSize(fontSize);
    doc.setTextColor(0);

    const lines = doc.splitTextToSize(content, maxWidth);

    lines.forEach(line => {
        if (yPos > 280) {
            doc.addPage();
            yPos = 10;
        }
        doc.text(line, margin, yPos);
        yPos += 7;
    });

    return yPos + 15;
}

}


function addSection(doc, title, content, yPos, fontSize, margin, maxWidth) {
  doc.setFontSize(14);
  doc.setTextColor(40, 53, 147);
  doc.text(title, margin, yPos);
  yPos += 8;

  doc.setFontSize(fontSize);
  doc.setTextColor(0);
  const lines = doc.splitTextToSize(content, maxWidth);
  
  lines.forEach(line => {
    if (yPos > 280) {
      doc.addPage();
      yPos = 10;
    }
    doc.text(line, margin, yPos);
    yPos += 7;
  });
  return yPos + 15;
}
document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById("theme-toggle");

  // Check stored theme preference
  chrome.storage.sync.get("theme", function (data) {
      if (data.theme === "dark") {
          document.body.classList.add("dark-mode");
          toggleSwitch.checked = true;
      } else {
          document.body.classList.add("light-mode");
      }
  });

  // Toggle theme on switch
  toggleSwitch.addEventListener("change", function () {
      if (toggleSwitch.checked) {
          document.body.classList.remove("light-mode");
          document.body.classList.add("dark-mode");
          chrome.storage.sync.set({ theme: "dark" });
      } else {
          document.body.classList.remove("dark-mode");
          document.body.classList.add("light-mode");
          chrome.storage.sync.set({ theme: "light" });
      }
  });
});
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "updatePopup") {
      const elements = {
          userInput: document.getElementById("userInput"),
      };

      // Only update if text is empty
      if (!elements.userInput.value.trim()) {
          elements.userInput.value = request.text;
      }
  }
});

