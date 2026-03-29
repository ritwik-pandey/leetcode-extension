import { initializeApp } from "firebase/app";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestore, collection, addDoc, updateDoc, arrayUnion } from "firebase/firestore";

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


  leaderboardList.innerHTML = "<li>Fetching leaderboard...</li>";
  const friendSection = document.querySelector('.friend-section');
  if (friendSection) {
    friendSection.style.display = 'none';  // hide it while loading leaderboard
  }



  function getLeetCodeUsername() {
    return new Promise((resolve) => {
      chrome.storage.sync.get("leetcodeUsername", (result) => {
        resolve(result.leetcodeUsername);
      });
    });
  }

  const username1 = await getLeetCodeUsername();

  const userDocRef = doc(db, "users", username1);
  let docSnap;
  try {
    docSnap = await getDoc(userDocRef);
  } catch (e) {
    console.warn("Firebase error, skipping friends sync.", e);
    leaderboardList.innerHTML = "<li>Database permission error. Cannot load friends.</li>";
    displaySortedLeaderboard([username1], leaderboardList, username1);
    return;
  }

  if (docSnap && docSnap.exists()) {
    const data = docSnap.data();
    const friendsArray = data.friends || [];  // Default to empty array if no friends field
    if (!friendsArray.includes(username1)) {
      friendsArray.push(username1);
      try {
        await updateDoc(userDocRef, { friends: arrayUnion(username1) });
      } catch (e) { console.warn("Could not update docs"); }
    }
    if (leaderboardList) {

      displaySortedLeaderboard(friendsArray, leaderboardList, username1);
      const toggle = document.getElementById('toggleView');
      toggle.addEventListener('change', () => {

        displaySortedLeaderboard(friendsArray, leaderboardList, username1);
      });
    } else {
      console.error("No element with id 'leaderboardlist' found.");
    }
  } else {
    console.log(`User document for ${username1} does not exist.`);
    displaySortedLeaderboard([username1], leaderboardList, username1);
  }



  async function displaySortedLeaderboard(friendsArray, leaderboardList, username1) {
    const friendSection = document.querySelector('.friend-section');
    const toggle = document.getElementById('toggleView');
    try {
      // Fetch both points and streaks
      const userDataPromises = friendsArray.map(async username => {
        const response = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${encodeURIComponent(username)}`);

        if (!response.ok) {
          return { username, points: 0, streak: 0, error: true };
        }

        const data = await response.json();

        const points = 1 * data.easySolved + 3 * data.mediumSolved + 7 * data.hardSolved;
        const streak = await getLeetCodeStreak(username);

        return { username, points, streak };
      });

      const usersData = await Promise.all(userDataPromises);

      // Sort by points or streak depending on toggle (default points)
      const isShowingStreaks = toggle.checked;

      usersData.sort((a, b) =>
        isShowingStreaks ? b.streak - a.streak : b.points - a.points
      );

      leaderboardList.innerHTML = "";

      usersData.forEach(({ username, points, streak, error }, index) => {
        const li = document.createElement("li");
        let trophyEmoji = "";
        if (index === 0) trophyEmoji = "🥇";
        else if (index === 1) trophyEmoji = "🥈";
        else if (index === 2) trophyEmoji = "🥉";

        const anchor = document.createElement("a");
        anchor.className = "username";
        anchor.href = `https://leetcode.com/u/${encodeURIComponent(username)}`;
        anchor.target = "_blank";
        anchor.style.textDecoration = "none";
        anchor.style.color = "inherit";

        if (index < 3) {
          anchor.innerHTML = `${trophyEmoji} ${username}`;
        } else {
          anchor.innerHTML = `${index + 1}. ${username}`;
        }

        const pointsSpan = document.createElement("span");
        pointsSpan.className = "points";

        if (isShowingStreaks) {
          pointsSpan.textContent = `${streak} 🔥`;
        } else {
          pointsSpan.textContent = `${points} 🪙`;
        }

        if (error) {
          pointsSpan.textContent += " ⚠️";
          pointsSpan.title = "Could not fetch stats for this user.";
        }

        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "−";
        removeBtn.title = `Remove ${username}`;

        removeBtn.addEventListener("click", async () => {
          // Your existing remove logic ...
        });

        if (username === username1) {
          li.classList.add("current-user");
        }

        li.appendChild(anchor);
        li.appendChild(pointsSpan);
        if (username !== username1) {
          li.appendChild(removeBtn);
        }

        leaderboardList.appendChild(li);
      });

      if (friendSection) {
        friendSection.style.display = 'block';
      }
    } catch (error) {
      console.error("Error building leaderboard:", error);
      leaderboardList.innerHTML = "<li>Error loading leaderboard.</li>";
    }
  }





  document.getElementById("backButton").addEventListener("click", () => {
    window.location.href = "popup.html";
  });

  const leaderboardBtn = document.getElementById("leaderboardBtn");
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener("click", () => {
      window.location.href = "leaderboard.html";
    });
  }

  document.getElementById("addFriendBtn").addEventListener("click", async () => {
    const addBtn = document.getElementById("addFriendBtn");
    const friendInput = document.getElementById("friendInput");
    const statusMsg = document.getElementById("addFriendStatus");
    const friendName = friendInput.value.trim();
    if (friendName) {

      addBtn.disabled = true;
      friendInput.disabled = true;
      if (statusMsg) {
        statusMsg.textContent = "Adding user...";
      }

      try {
        const username = await getLeetCodeUsername();
        if (!username) {
          if (statusMsg) statusMsg.textContent = "Current username not found.";
          return;
        }
        const userDocRef = doc(db, "users", username);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          await updateDoc(userDocRef, {
            friends: arrayUnion(friendName)
          });
          const updatedDocSnap = await getDoc(userDocRef);
          const updatedFriends = updatedDocSnap.data().friends || [];
          displaySortedLeaderboard(updatedFriends, leaderboardList, username);
          if (statusMsg) statusMsg.textContent = "User added successfully!";
        } else {
          if (statusMsg) statusMsg.textContent = "Username does not exist.";
        }
      } catch (err) {
        console.error(err);
        if (statusMsg) statusMsg.textContent = "Error adding user.";
      } finally {
        addBtn.disabled = false;
        friendInput.disabled = false;
        friendInput.value = "";

        setTimeout(() => {
          if (statusMsg) statusMsg.textContent = "";
        }, 2000);
      }
    }
  });


  async function getLeetCodeStreak(username) {
    const response = await fetch(
      `https://leetcode-api-faisalshohag.vercel.app/${encodeURIComponent(username)}`
    );
    if (!response.ok) {
      throw new Error(`Request failed for user ${username}`);
    }
    const data = await response.json();
    const calendar = data.submissionCalendar;
    if (!calendar) {
      return 0; // no calendar data
    }

    // Convert keys (UNIX timestamps) to numbers and sort descending (latest first)
    const days = Object.keys(calendar)
      .map(Number)
      .sort((a, b) => b - a);

    // Helper to get a date string (UTC midnight)
    function toDateString(ts) {
      return new Date(ts * 1000).toISOString().slice(0, 10);
    }

    // Create a Set of all days with submissions (date strings)
    const submissionDays = new Set(
      days.map(toDateString)
    );

    // Start from today, check for consecutive days with submissions
    let streak = 0;
    let current = new Date();
    current.setUTCHours(0, 0, 0, 0); // Set to midnight UTC

    while (submissionDays.has(current.toISOString().slice(0, 10))) {
      streak++;
      // Go to previous day
      current.setUTCDate(current.getUTCDate() - 1);
    }

    return streak;
  }
});