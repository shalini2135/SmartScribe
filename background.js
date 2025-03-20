const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_API_KEY = "AIzaSyAvNvRIAg_GdRfdNOeTbrHAd_V9lbTR-g4";
chrome.runtime.onStartup.addListener(() => {
  console.log("Service Worker Activated on Startup");
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension Installed: Creating Context Menu");
  chrome.contextMenus.create({
    id: "generateNotes",
    title: "Generate Study Materials",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("Context Menu Clicked!", info.selectionText);
  if (!info.selectionText) return;
  
  chrome.tabs.sendMessage(tab.id, {
    action: "openPopup",
    selectedText: info.selectionText
  });

  try {
    const selectedText = info.selectionText.trim();
    const { questionsAnswers, revisionNotes } = await getAIResponse(
      `Generate 5 practice questions with answers and quick revision notes from this text. Format EXACTLY like:
      |||QUESTIONS|||
      1. [Question]
         [Answer]
      2. [Question]
         [Answer]
      ...
      |||NOTES|||
      - [Bullet point 1]
      - [Bullet point 2]
      ...
      Text: "${selectedText}"`
    );
    const youtubeUrls = await fetchYouTubeVideo(selectedText);

    await chrome.storage.local.set({
      questionsAnswers,
      revisionNotes,
      originalText: selectedText,
      youtubeUrls
    });

    // Update history
    chrome.storage.local.get(["history"], async ({ history = [] }) => {
      const newEntry = {
        id: Date.now(), // Unique ID for each entry
        text: selectedText,
        questions: questionsAnswers,
        notes: revisionNotes,
        youtubeUrls,
        timestamp: Date.now()
      };
      
      const updatedHistory = [newEntry, ...history].slice(0, 10);
    
      await chrome.storage.local.set({ history: updatedHistory });
    });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Materials Ready!',
      message: 'Click extension icon to view/download'
    });

  } catch (error) {
    console.error('Background Error:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Generation Failed',
      message: error.message
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateNotes") {
      (async () => {
          try {
              const selectedText = request.text || "";  // Directly access text from the message

              const { questionsAnswers, revisionNotes } = await getAIResponse(
                  `Generate 5 practice questions with answers and quick revision notes from this text. Format EXACTLY like:
                  |||QUESTIONS|||
                  1. [Question]
                     [Answer]
                  2. [Question]
                     [Answer]
                  ...
                  |||NOTES|||
                  - [Bullet point 1]
                  - [Bullet point 2]
                  ...
                  Text: "${selectedText}"`  
              );

              const youtubeUrls = await fetchYouTubeVideo(selectedText);

              await chrome.storage.local.set({
                  questionsAnswers,
                  revisionNotes,
                  originalText: selectedText,
                  youtubeUrls
              });

              // Update history
              chrome.storage.local.get(["history"], ({ history = [] }) => {
                  const newEntry = {
                      id: Date.now(),
                      text: selectedText,
                      questions: questionsAnswers,
                      notes: revisionNotes,
                      youtubeUrls,
                      timestamp: Date.now()
                  };

                  const updatedHistory = [newEntry, ...history].slice(0, 10);
                  chrome.storage.local.set({ history: updatedHistory });
              });

              sendResponse({ questionsAnswers, revisionNotes, youtubeUrls });
          } catch (error) {
              sendResponse({ error: error.message });
          }
      })();

      return true;  // Ensures async operations can respond
  }
});


async function getAIResponse(promptText) {
  const apiKey = "AIzaSyAit_fWmGlJEAndS1e_rYWP5Fg2JvnAt9E";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    
    const questionMatch = fullResponse.match(/\|\|\|QUESTIONS\|\|\|([\s\S]*?)\|\|\|NOTES\|\|\|/);
    const notesMatch = fullResponse.match(/\|\|\|NOTES\|\|\|([\s\S]*)/);

    return {
      questionsAnswers: questionMatch?.[1]?.trim() || "No questions generated",
      revisionNotes: notesMatch?.[1]?.trim() || "No notes generated"
    };
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(`API Error: ${error.message}`);
  }
}

async function fetchYouTubeVideo(query) {
  const url = `${YOUTUBE_SEARCH_URL}?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${YOUTUBE_API_KEY}`;
  try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch YouTube data");

      const data = await response.json();
      const videoLinks = data.items.map(item => `https://www.youtube.com/watch?v=${item.id.videoId}`);
      
      return videoLinks; // Return an array of links
  } catch (error) {
      console.error("YouTube Fetch Error:", error);
      return [];
  }
}


function generateQuestions(text) {
  return `Sample Question for: ${text}\n- What is the main idea?\n- Explain in detail.`;
}

function generateNotes(text) {
  return `Summary: ${text.substring(0, 100)}... (truncated)`;
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "contentSelected") {
      chrome.storage.local.set({ originalText: request.text }, () => {
          chrome.runtime.sendMessage({ action: "updatePopup", text: request.text });
      });
  }
});
