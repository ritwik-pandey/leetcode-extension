function getQuestionSlugFromURL() {
  const url = window.location.href;
  const match = url.match(/leetcode\.com\/problems\/([^\/]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

//Using api to fetch question data

async function fetchLeetCodeProblem(titleSlug) {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        content
        difficulty
        sampleTestCase
        codeSnippets { lang code }
        topicTags { name }
      }
    }
  `;
  const variables = { titleSlug };
  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const data = await response.json();
  return data.data.question;
}

//gemini
async function getGeminiCompletion(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  // Extract response text
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "No response from Gemini API"
  );
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "SCRAPE_QUESTION") {
    (async () => {
      try {
        const slug = getQuestionSlugFromURL();
        const question = await fetchLeetCodeProblem(slug);

        const prompt = `Give exactly 3 easily readable with no text formatting no bold , hints formatted like this:
## Hint 1 ##
<text>

## Hint 2 ##
<text>

## Hint 3 ##
<text>

For the following problem: Title: ${question.title} \nDescription: ${question.content}`;

        const completion = await getGeminiCompletion(prompt);
        console.log(completion);


        chrome.storage.sync.set({
          lastPrompt: prompt,
          lastResponse: completion,
          lastProblemSlug: slug,
          lastProblemTitle: question.title
        }, () => {
          console.log("Prompt and response saved to chrome.storage.sync");
        });

        sendResponse({ hints: completion });
      } catch (error) {
        console.error("Error in SCRAPE_QUESTION:", error);
        sendResponse({ hints: "❌ Error generating hints." });
      }
    })();

    return true;
  }
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_LEETCODE_CODE") {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    document.documentElement.appendChild(script);

    async function handleMessage(event) {
      if (event.source !== window) return; // only accept messages from same window
      if (event.data && event.data.type === "LEETCODE_CODE_EXTRACTED") {
        const slug = getQuestionSlugFromURL();
        const question = await fetchLeetCodeProblem(slug);
        const prompt = `Given below is the implementation of the leetcode problemdone by the user. There are most likely logical error in it 
        In one short paragraph explain the errors as a computer science fellow student, in proper grammer and in short way that you think are possible regarding logical errors with no text formating including no bold but be a bit formal 
        ${event.data.code}

            For the following problem: Title: ${question.title} \nDescription: ${question.content}`;

        const completion = await getGeminiCompletion(prompt);

        window.removeEventListener("message", handleMessage);
        sendResponse({ code: completion || "" });
      }
    }

    window.addEventListener("message", handleMessage);

    return true;  // keeping message channel open for async sendResponse
  }
});

