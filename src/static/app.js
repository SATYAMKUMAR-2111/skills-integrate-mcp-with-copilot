document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const profilePanel = document.getElementById("profile-panel");
  const authForms = document.getElementById("auth-forms");
  const profileInfo = document.getElementById("profile-info");
  const updateProfileForm = document.getElementById("update-profile-form");
  const changePasswordForm = document.getElementById("change-password-form");
  const verifySection = document.getElementById("verify-section");
  const verifyForm = document.getElementById("verify-form");
  const loggedInEmail = document.getElementById("logged-in-email");

  const tokenKey = "mhs_token";
  let currentUser = null;

  function showMessage(message, type = "info") {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function getToken() {
    return localStorage.getItem(tokenKey);
  }

  function setToken(token) {
    localStorage.setItem(tokenKey, token);
  }

  function clearToken() {
    localStorage.removeItem(tokenKey);
  }

  function getAuthHeaders() {
    const token = getToken();
    if (!token) {
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  }

  async function authFetch(url, options = {}) {
    const headers = {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });
    return response;
  }

  function updateAuthUI(user) {
    if (user) {
      currentUser = user;
      profilePanel.classList.remove("hidden");
      authForms.classList.add("hidden");
      loggedInEmail.textContent = `Logged in as ${user.email}`;
      loggedInEmail.classList.remove("hidden");
      if (user.verified) {
        verifySection.classList.add("hidden");
      } else {
        verifySection.classList.remove("hidden");
      }
      profileInfo.innerHTML = `
        <strong>Name:</strong> ${user.name || "(not set)"}<br />
        <strong>Email:</strong> ${user.email}<br />
        <strong>Role:</strong> ${user.role}<br />
        <strong>Verified:</strong> ${user.verified ? "Yes" : "No"}
      `;
    } else {
      currentUser = null;
      profilePanel.classList.add("hidden");
      authForms.classList.remove("hidden");
      loggedInEmail.textContent = "";
      loggedInEmail.classList.add("hidden");
      verifySection.classList.add("hidden");
    }
  }

  async function loadProfile() {
    const token = getToken();
    if (!token) {
      updateAuthUI(null);
      return;
    }

    try {
      const response = await authFetch("/auth/me");
      if (!response.ok) {
        clearToken();
        updateAuthUI(null);
        return;
      }

      const user = await response.json();
      updateAuthUI(user);
    } catch (error) {
      console.error("Error loading profile:", error);
      clearToken();
      updateAuthUI(null);
    }
  }

  async function fetchActivities() {
    try {
      const response = await authFetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${details.participants
                    .map(
                      (email) =>
                        `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                    )
                    .join("")}
                </ul>
              </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await authFetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      console.error("Error unregistering:", error);
      showMessage("Failed to unregister. Please try again.", "error");
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById("email");
    const email = currentUser ? currentUser.email : emailInput.value.trim();
    const activity = activitySelect.value;

    if (!activity) {
      showMessage("Please select an activity.", "error");
      return;
    }

    if (!email) {
      showMessage("Please provide your email address.", "error");
      return;
    }

    try {
      const response = await authFetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      console.error("Error signing up:", error);
      showMessage("Failed to sign up. Please try again.", "error");
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("register-email").value.trim();
    const name = document.getElementById("register-name").value.trim();
    const password = document.getElementById("register-password").value;
    const role = document.getElementById("register-role").value;

    try {
      const response = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, role }),
      });

      const result = await response.json();
      if (response.ok) {
        showMessage(`Registered ${result.email}. Verification code: ${result.verification_code}`, "success");
        registerForm.reset();
      } else {
        showMessage(result.detail || "Registration failed.", "error");
      }
    } catch (error) {
      console.error("Error registering:", error);
      showMessage("Failed to register. Please try again.", "error");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (response.ok) {
        setToken(result.token);
        updateAuthUI(result.user);
        showMessage("Login successful.", "success");
      } else {
        showMessage(result.detail || "Login failed.", "error");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      showMessage("Failed to log in. Please try again.", "error");
    }
  });

  logoutButton.addEventListener("click", () => {
    clearToken();
    updateAuthUI(null);
    showMessage("Logged out successfully.", "info");
  });

  updateProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("update-name").value.trim();

    if (!name) {
      showMessage("Please enter a name to update.", "error");
      return;
    }

    try {
      const response = await authFetch("/auth/me", {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (response.ok) {
        updateAuthUI(result);
        showMessage("Profile updated successfully.", "success");
        updateProfileForm.reset();
      } else {
        showMessage(result.detail || "Update failed.", "error");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      showMessage("Failed to update profile. Please try again.", "error");
    }
  });

  changePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;

    try {
      const response = await authFetch("/auth/me/password", {
        method: "POST",
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        changePasswordForm.reset();
      } else {
        showMessage(result.detail || "Password update failed.", "error");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      showMessage("Failed to change password. Please try again.", "error");
    }
  });

  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = document.getElementById("verify-code").value.trim();
    const email = currentUser?.email;

    if (!email) {
      showMessage("You must be logged in to verify your email.", "error");
      return;
    }

    try {
      const response = await fetch("/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        loadProfile();
        verifyForm.reset();
      } else {
        showMessage(result.detail || "Verification failed.", "error");
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      showMessage("Failed to verify email. Please try again.", "error");
    }
  });

  loadProfile();
  fetchActivities();
});
