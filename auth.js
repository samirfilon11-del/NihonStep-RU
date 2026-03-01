const DB_KEY = "jp-learning-db";
const SESSION_KEY = "jp-learning-session";

const el = {
  showLoginBtn: document.getElementById("showLoginBtn"),
  showRegisterBtn: document.getElementById("showRegisterBtn"),
  authUsername: document.getElementById("authUsername"),
  authPassword: document.getElementById("authPassword"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  guestEnterBtn: document.getElementById("guestEnterBtn"),
  authMessage: document.getElementById("authMessage")
};

let authMode = "login";

function loadDB() {
  try {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    db.users = db.users || {};
    return db;
  } catch {
    return { users: {} };
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function setSession(username) {
  localStorage.setItem(SESSION_KEY, username);
}

function setMode(mode) {
  authMode = mode;
  el.authSubmitBtn.textContent = mode === "login" ? "Войти" : "Создать аккаунт";
  el.authMessage.textContent = "";
}

function openCabinet() {
  window.location.href = "./index.html";
}

function showMessage(text) {
  el.authMessage.textContent = text;
}

function submitAuth() {
  const username = String(el.authUsername.value || "").trim();
  const password = String(el.authPassword.value || "").trim();

  if (!username || !password) {
    showMessage("Введите логин и пароль");
    return;
  }

  if (username.length < 3 || password.length < 4) {
    showMessage("Логин от 3 символов, пароль от 4 символов");
    return;
  }

  const db = loadDB();

  if (authMode === "register") {
    if (db.users[username]) {
      showMessage("Такой логин уже существует");
      return;
    }
    db.users[username] = {
      password,
      profile: {
        createdAt: new Date().toISOString(),
        goal: "",
        photo: "",
        dailyGoal: 50
      },
      progress: {
        learned: {},
        score: 0,
        streak: 0,
        lastStudyDate: "",
        hearts: 5,
        todayXp: 0,
        todayDate: ""
      }
    };
    saveDB(db);
  }

  const user = db.users[username];
  if (!user || user.password !== password) {
    showMessage("Неверный логин или пароль");
    return;
  }

  setSession(username);
  openCabinet();
}

function enterGuest() {
  setSession("guest");
  openCabinet();
}

function init() {
  el.showLoginBtn.addEventListener("click", () => setMode("login"));
  el.showRegisterBtn.addEventListener("click", () => setMode("register"));
  el.authSubmitBtn.addEventListener("click", submitAuth);
  el.guestEnterBtn.addEventListener("click", enterGuest);
  setMode("login");
}

init();
