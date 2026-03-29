import { initializeApp } from "firebase/app";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


document.addEventListener("DOMContentLoaded", async () => {

  const hintSection = document.getElementById("hintSection");
  const notProblemSection = document.getElementById("notProblemSection");
  const hintButton = document.getElementById("hintButton");
  const hintContainer = document.getElementById("hintContainer");
  const usernameInput = document.getElementById("leetcodeUsernameInput");
  const saveBtn = document.getElementById("saveLeetCodeUsernameBtn");
  const profileBtn = document.getElementById("profileButton");
  const profileContainer = document.getElementById("profileContainer");
  const profileDetails = document.getElementById("profileDetails");
  const usernameSection = document.getElementById("leetcodeUsernameSection");
  const codeSection = document.getElementById("codeSection");
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  if (leaderboardBtn) leaderboardBtn.style.display = "none"; // hide by default

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isLeetCodeProblem = tab?.url?.startsWith("https://leetcode.com/problems/") || false;

  chrome.storage.sync.get(["leetcodeUsername"], (data) => {
    if (data.leetcodeUsername) {
      // Hide input, show profile
      usernameSection.style.display = "none";
      profileContainer.style.display = "block";
      if (leaderboardBtn) leaderboardBtn.style.display = "block";
    }
  });
  const leetInput = document.getElementById("leetcodeUsernameInput");

  leetInput.addEventListener("focus", () => {
    leetInput.style.border = "1px solid #ffcc70";
    leetInput.style.boxShadow = "0 0 0 2px rgba(255, 204, 112, 0.2)";
  });

  leetInput.addEventListener("blur", () => {
    leetInput.style.border = "1px solid #444";
    leetInput.style.boxShadow = "none";
  });

  // On Save button click, Profile gets saved
  saveBtn.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    console.log("LeetCode Username saved:", username);
    try {
      const userDocRef = doc(db, "users", username);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          friends: [],
          // other fields you want to add...
        });
      }
    } catch (e) {
      console.warn("Firebase database error. Saving local username anyway.", e);
    }


    if (username.length > 0) {
      chrome.storage.sync.set({ leetcodeUsername: username }, () => {
        usernameSection.style.display = "none";
        profileContainer.style.display = "block";
        if (leaderboardBtn) leaderboardBtn.style.display = "block";
        profileDetails.innerHTML = ""; // clear previous data
      });
    }
  });

  document.getElementById("leaderboardBtn").addEventListener("click", () => {
    window.location.href = "leaderboard.html";
  });


  // On Profile button click
  profileBtn.addEventListener("click", async () => {

    // Use Promise wrapper for chrome.storage.sync.get
    function getLeetCodeUsername() {
      return new Promise((resolve) => {
        chrome.storage.sync.get("leetcodeUsername", (result) => {
          resolve(result.leetcodeUsername);
        });
      });
    }

    const username = await getLeetCodeUsername();
    if (!username) {
      profileDetails.innerHTML = "❌ No username saved.";
      return;
    }


    profileDetails.innerHTML = "⏳ Fetching profile...";
    try {


      const response = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${encodeURIComponent(username)}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }


      const data = await response.json();
      console.log("API response data:", data);
      const points = 1 * data.easySolved + (3 * data.mediumSolved) + (7 * data.hardSolved);
      const info = document.getElementById("profileDetails");


      info.innerHTML = "";
      const content = document.createElement("div");
      const profile = `
        👤 <strong>
          <a 
            href="https://leetcode.com/u/${encodeURIComponent(username)}" 
            target="_blank" 
            rel="noopener noreferrer" 
            style="color: inherit; text-decoration: none; cursor: pointer;"
          >
            ${username}
          </a>
        </strong><br/>
        🧩 Solved: ${data.totalSolved}/${data.totalQuestions}<br/>
        🏆 Ranking: #${data.ranking}<br/>
        🪙 Your Points: ${points}
      `;
      content.innerHTML = profile;


      info.appendChild(content);

    } catch (err) {
      console.error("Error fetching profile:", err);
      profileDetails.innerHTML = "❌ Error loading profile.";
    }
  });


  document.getElementById("logoutBtn").addEventListener("click", () => {
    chrome.storage.sync.remove("leetcodeUsername", () => {
      // Reset UI
      usernameInput.value = "";
      usernameSection.style.display = "block";
      profileContainer.style.display = "none";
      if (leaderboardBtn) leaderboardBtn.style.display = "none";
      profileDetails.innerHTML = "";
    });
  });




  if (isLeetCodeProblem) {
    hintSection.style.display = "block";
    chrome.storage.sync.get(["lastHints", "lastUrl"], (data) => {
      if (data.lastHints && data.lastUrl === tab.url) {
        const hints = parseHintsByMarkers(data.lastHints);
        renderHints(hints);
      }
    });

    hintButton.addEventListener("click", () => {
      hintContainer.innerHTML = `<p class="info">⏳ Generating hints, please wait...</p>`;

      chrome.tabs.sendMessage(
        tab.id,
        { type: "SCRAPE_QUESTION" },
        (response) => {
          if (chrome.runtime.lastError) {
            hintContainer.innerHTML = `<p class="info">❌ Error: ${chrome.runtime.lastError.message}</p>`;
            return;
          }

          if (response && response.hints) {
            // Parse and display
            const hints = parseHintsByMarkers(response.hints);
            renderHints(hints);

            // Save to chrome.storage.sync
            chrome.storage.sync.set({
              lastHints: response.hints,
              lastUpdated: new Date().toISOString(),
              lastUrl: tab.url
            }, () => {
              console.log("Hints saved to storage.");
            });
          } else {
            hintContainer.innerHTML = `<p class="info">⚠️ No hints found.</p>`;
          }
        }
      );

    });

    document.getElementById('errorButton').addEventListener("click", () => {
      const errorContainer = document.getElementById("errorContainer");
      errorContainer.innerHTML = '<p class="info">Generating Error :)</p>';

      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.tabs.sendMessage(tab.id, { type: "GET_LEETCODE_CODE" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message send error:", chrome.runtime.lastError);
            errorContainer.innerHTML = `<p class="error">Error: ${chrome.runtime.lastError.message}</p>`;
            return;
          }
          console.log("[Popup] LeetCode code:", response.code);
          const details = document.createElement("details");
          const summary = document.createElement("summary");
          details.appendChild(summary);
          summary.textContent = `Show Suggestions`;
          const content = document.createElement("div");
          content.textContent = response.code;

          details.appendChild(summary);
          details.appendChild(content);
          errorContainer.innerHTML = "";
          errorContainer.appendChild(details);
        });
      });
    });




  } else {
    notProblemSection.style.display = "block";
    hintSection.style.display = "none";
    codeSection.style.display = "none";
  }
  function parseHintsByMarkers(text) {
    const parts = text
      .split(/##\s*Hint\s*\d\s*##/i)
      .map((p) => p.trim())
      .filter((p) => p);
    return parts.slice(0, 3); // Ensure max 3
  }

  function renderHints(hints) {
    hintContainer.innerHTML = ""; // Clear loading
    hints.forEach((hint, index) => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");

      details.appendChild(summary);

      summary.textContent = `Hint ${index + 1}`;
      const content = document.createElement("div");
      content.textContent = hint;
      details.appendChild(summary);


      details.appendChild(content);
      hintContainer.appendChild(details);
    });
  }



});

