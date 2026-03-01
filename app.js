import { grammarData } from "./data/grammar.js";
import { kanjiData } from "./data/kanji.js";
import { dictionaryData } from "./data/dictionary.js";
import { hiragana, katakana } from "./data/kana.js";

const DB_KEY = "jp-learning-db";
const SESSION_KEY = "jp-learning-session";
const levels = ["ALL", "N5", "N4", "N3", "N2", "N1"];
const DISPLAY_LIMIT = 200;
const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"];
const COURSE_PLAN = { N5: 80, N4: 110, N3: 140, N2: 170, N1: 220 };

let currentUser = null;
const quizCache = {};
const kanjiInfoCache = new Map();
const strokeSvgCache = new Map();
const kanjiReadingCache = new Map();
let trainerState = null;
const dictionaryById = new Map(dictionaryData.map((item) => [String(item.id), item]));

const el = {
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".panel")],
  currentUser: document.getElementById("currentUser"),
  logoutBtn: document.getElementById("logoutBtn"),
  learnedCount: document.getElementById("learnedCount"),
  scoreCount: document.getElementById("scoreCount"),
  reset: document.getElementById("resetProgress"),
  grammarLevel: document.getElementById("grammarLevel"),
  grammarSearch: document.getElementById("grammarSearch"),
  grammarList: document.getElementById("grammarList"),
  kanjiLevel: document.getElementById("kanjiLevel"),
  kanjiSearch: document.getElementById("kanjiSearch"),
  kanjiList: document.getElementById("kanjiList"),
  dictDirection: document.getElementById("dictDirection"),
  dictSearch: document.getElementById("dictSearch"),
  dictList: document.getElementById("dictList"),
  hiraganaGrid: document.getElementById("hiraganaGrid"),
  katakanaGrid: document.getElementById("katakanaGrid"),
  courseUnlockedLevel: document.getElementById("courseUnlockedLevel"),
  courseCompletedCount: document.getElementById("courseCompletedCount"),
  courseTotalCount: document.getElementById("courseTotalCount"),
  courseLevelProgress: document.getElementById("courseLevelProgress"),
  courseLessons: document.getElementById("courseLessons"),
  nextQuestion: document.getElementById("nextQuestion"),
  quizTitle: document.getElementById("quizTitle"),
  quizProgress: document.getElementById("quizProgress"),
  quizOptions: document.getElementById("quizOptions"),
  quizFeedback: document.getElementById("quizFeedback"),
  profileName: document.getElementById("profileName"),
  profileCreated: document.getElementById("profileCreated"),
  profileLearned: document.getElementById("profileLearned"),
  profileScore: document.getElementById("profileScore"),
  profileGoal: document.getElementById("profileGoal"),
  profileLevel: document.getElementById("profileLevel"),
  profileXpToNext: document.getElementById("profileXpToNext"),
  profileStreak: document.getElementById("profileStreak"),
  profileHearts: document.getElementById("profileHearts"),
  profileDailyGoal: document.getElementById("profileDailyGoal"),
  profileTodayXp: document.getElementById("profileTodayXp"),
  goalInput: document.getElementById("goalInput"),
  saveGoalBtn: document.getElementById("saveGoalBtn"),
  duoPath: document.getElementById("duoPath"),
  profileAvatar: document.getElementById("profileAvatar"),
  avatarInput: document.getElementById("avatarInput"),
  removeAvatarBtn: document.getElementById("removeAvatarBtn"),
  kanjiModal: document.getElementById("kanjiModal"),
  kanjiModalBody: document.getElementById("kanjiModalBody"),
  kanjiModalTitle: document.getElementById("kanjiModalTitle"),
  kanjiModalClose: document.getElementById("kanjiModalClose"),
  wordModal: document.getElementById("wordModal"),
  wordModalBody: document.getElementById("wordModalBody"),
  wordModalTitle: document.getElementById("wordModalTitle"),
  wordModalClose: document.getElementById("wordModalClose")
};

function escapeHTML(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function ensureUser(user) {
  user.profile = user.profile || {};
  user.progress = user.progress || {};
  user.profile.createdAt = user.profile.createdAt || new Date().toISOString();
  user.profile.goal = user.profile.goal || "";
  user.profile.photo = user.profile.photo || "";
  user.profile.dailyGoal = Number(user.profile.dailyGoal || 50);

  user.progress.learned = user.progress.learned || {};
  user.progress.score = Number(user.progress.score || 0);
  user.progress.streak = Number(user.progress.streak || 0);
  user.progress.lastStudyDate = user.progress.lastStudyDate || "";
  user.progress.hearts = Number(user.progress.hearts || 5);
  user.progress.todayXp = Number(user.progress.todayXp || 0);
  user.progress.todayDate = user.progress.todayDate || "";
  user.progress.course = user.progress.course || {};
  user.progress.course.unlockedLevel = user.progress.course.unlockedLevel || "N5";
  user.progress.course.completedLessons = user.progress.course.completedLessons || {};
}

function getUserRecord() {
  if (!currentUser || currentUser === "guest") return null;
  const db = loadDB();
  const user = db.users[currentUser] || null;
  if (user) ensureUser(user);
  return user;
}

function saveUserRecord(user) {
  if (!currentUser || currentUser === "guest") return;
  const db = loadDB();
  ensureUser(user);
  db.users[currentUser] = user;
  saveDB(db);
}

function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = "./auth.html";
    return false;
  }
  if (session === "guest") {
    currentUser = "guest";
    return true;
  }
  const db = loadDB();
  if (!db.users[session]) {
    window.location.href = "./auth.html";
    return false;
  }
  currentUser = session;
  return true;
}

function addXP(amount) {
  if (currentUser === "guest") return;
  const user = getUserRecord();
  if (!user) return;

  ensureUser(user);
  user.progress.score += amount;

  const today = new Date().toISOString().slice(0, 10);
  if (user.progress.todayDate !== today) {
    user.progress.todayDate = today;
    user.progress.todayXp = 0;
  }
  user.progress.todayXp += amount;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (!user.progress.lastStudyDate) {
    user.progress.streak = 1;
  } else if (user.progress.lastStudyDate === today) {
    user.progress.streak = Math.max(1, user.progress.streak);
  } else if (user.progress.lastStudyDate === yesterday) {
    user.progress.streak += 1;
  } else {
    user.progress.streak = 1;
  }
  user.progress.lastStudyDate = today;

  saveUserRecord(user);
}

function markLearned(id) {
  if (currentUser === "guest") return;
  const user = getUserRecord();
  if (!user) return;
  ensureUser(user);
  user.progress.learned[id] = true;
  saveUserRecord(user);
  addXP(5);
}

function normalizeMeaningToRu(text) {
  const value = String(text || "").trim();
  if (!value) return "нет перевода";
  return value;
}

function splitMeanings(text) {
  const raw = String(text || "").trim();
  if (!raw) return ["нет значения"];
  const parts = raw.split(/[;,/]|(?:\s-\s)/g).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [raw];
}

function meaningListHTML(meanings) {
  return `<ol>${meanings.map((m) => `<li>${escapeHTML(normalizeMeaningToRu(m))}</li>`).join("")}</ol>`;
}

function fillLevelSelect(select) {
  if (!select) return;
  select.innerHTML = levels.map((level) => `<option value="${level}">${level}</option>`).join("");
}

function filterByLevel(items, level) {
  return level === "ALL" ? items : items.filter((x) => x.level === level);
}

function listWithLimitInfo(items, renderer) {
  const total = items.length;
  const shown = items.slice(0, DISPLAY_LIMIT);
  const info = total > DISPLAY_LIMIT ? `<article class="card"><strong>Показано ${DISPLAY_LIMIT} из ${total}.</strong> Уточните поиск.</article>` : "";
  return info + shown.map(renderer).join("");
}

function createRomajiMap() {
  const map = new Map();
  [...hiragana, ...katakana].forEach(([k, r]) => map.set(k, r));
  return map;
}

const romajiMap = createRomajiMap();

function toRomaji(input) {
  const str = String(input || "");
  let out = "";
  for (let i = 0; i < str.length; i += 1) {
    const nextTwo = str.slice(i, i + 2);
    if (romajiMap.has(nextTwo)) {
      out += romajiMap.get(nextTwo);
      i += 1;
      continue;
    }
    const ch = str[i];
    if (romajiMap.has(ch)) out += romajiMap.get(ch);
    else out += ch;
  }
  return out;
}

function romajiToCyr(input) {
  let s = String(input || "").toLowerCase();
  const rules = [
    ["kyo", "кё"], ["kyu", "кю"], ["kya", "кя"], ["sho", "сё"], ["shu", "сю"], ["sha", "ся"],
    ["chi", "ти"], ["shi", "си"], ["tsu", "цу"], ["fu", "фу"], ["ji", "дзи"],
    ["ka", "ка"], ["ki", "ки"], ["ku", "ку"], ["ke", "кэ"], ["ko", "ко"],
    ["sa", "са"], ["su", "су"], ["se", "сэ"], ["so", "со"], ["ta", "та"], ["te", "тэ"], ["to", "то"],
    ["na", "на"], ["ni", "ни"], ["nu", "ну"], ["ne", "нэ"], ["no", "но"], ["ha", "ха"], ["hi", "хи"],
    ["he", "хэ"], ["ho", "хо"], ["ma", "ма"], ["mi", "ми"], ["mu", "му"], ["me", "мэ"], ["mo", "мо"],
    ["ra", "ра"], ["ri", "ри"], ["ru", "ру"], ["re", "рэ"], ["ro", "ро"], ["ya", "я"], ["yu", "ю"], ["yo", "ё"],
    ["wa", "ва"], ["n", "н"], ["a", "а"], ["i", "и"], ["u", "у"], ["e", "э"], ["o", "о"]
  ];
  rules.forEach(([a, b]) => { s = s.split(a).join(b); });
  return s;
}

function kanaToCyr(input) {
  return romajiToCyr(toRomaji(input));
}

function splitReadings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((x) => String(x).split(/[・,]/g)).map((x) => x.trim()).filter(Boolean);
}

function buildReadingMeta(info) {
  const onyomiJp = splitReadings(info?.onyomi || info?.on_readings || []);
  const kunyomiJp = splitReadings(info?.kunyomi || info?.kun_readings || []);
  const onyomiEn = onyomiJp.map((x) => toRomaji(x));
  const kunyomiEn = kunyomiJp.map((x) => toRomaji(x));
  const onyomiRu = onyomiEn.map((x) => romajiToCyr(x));
  const kunyomiRu = kunyomiEn.map((x) => romajiToCyr(x));
  return {
    onyomiJp: onyomiJp.length ? onyomiJp : ["нет"],
    kunyomiJp: kunyomiJp.length ? kunyomiJp : ["нет"],
    onyomiEn: onyomiEn.length ? onyomiEn : ["нет"],
    kunyomiEn: kunyomiEn.length ? kunyomiEn : ["нет"],
    onyomiRu: onyomiRu.length ? onyomiRu : ["нет"],
    kunyomiRu: kunyomiRu.length ? kunyomiRu : ["нет"]
  };
}

async function loadKanjiInfo(ch) {
  if (kanjiInfoCache.has(ch)) return kanjiInfoCache.get(ch);
  const res = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(ch)}`);
  if (!res.ok) throw new Error(`kanjiapi ${res.status}`);
  const data = await res.json();
  kanjiInfoCache.set(ch, data);
  return data;
}

async function preloadKanji(chars) {
  const unique = [...new Set(chars)].filter((ch) => ch && !kanjiReadingCache.has(ch));
  if (!unique.length) return false;
  let changed = false;
  await Promise.all(unique.slice(0, 28).map(async (ch) => {
    try {
      const info = await loadKanjiInfo(ch);
      kanjiReadingCache.set(ch, buildReadingMeta(info));
      changed = true;
    } catch {
      kanjiReadingCache.set(ch, buildReadingMeta(null));
      changed = true;
    }
  }));
  return changed;
}

function renderKana() {
  if (el.hiraganaGrid) {
    el.hiraganaGrid.innerHTML = hiragana.map(([k, r]) => `<div class="kana-cell"><div class="kana-char">${k}</div><div class="kana-romaji">${r}</div></div>`).join("");
  }
  if (el.katakanaGrid) {
    el.katakanaGrid.innerHTML = katakana.map(([k, r]) => `<div class="kana-cell"><div class="kana-char">${k}</div><div class="kana-romaji">${r}</div></div>`).join("");
  }
}

function renderGrammar() {
  const level = el.grammarLevel.value;
  const q = el.grammarSearch.value.trim().toLowerCase();
  const filtered = filterByLevel(grammarData, level).filter((x) => `${x.pattern} ${x.ru} ${x.example}`.toLowerCase().includes(q));
  el.grammarList.innerHTML = listWithLimitInfo(filtered, (item) => `
    <article class="card">
      <h3>${item.pattern}</h3>
      <p><strong>Перевод:</strong> ${item.ru}</p>
      <p><strong>Пример:</strong> ${item.example}</p>
      <p><strong>Чтение JP:</strong> ${item.pattern}</p>
      <p><strong>Чтение RU:</strong> ${kanaToCyr(item.pattern)}</p>
      <p><strong>Чтение EN:</strong> ${toRomaji(item.pattern)}</p>
      <div class="meta"><span class="badge">${item.level}</span></div>
      <button class="mark-btn" data-id="grammar:${item.id}">Я выучил(а)</button>
    </article>
  `);
}

function renderKanji() {
  const level = el.kanjiLevel.value;
  const q = el.kanjiSearch.value.trim().toLowerCase();
  const filtered = filterByLevel(kanjiData, level).filter((x) => `${x.kanji} ${x.ru}`.toLowerCase().includes(q));
  void preloadKanji(filtered.slice(0, DISPLAY_LIMIT).map((x) => x.kanji)).then((changed) => { if (changed) renderKanji(); });

  el.kanjiList.innerHTML = listWithLimitInfo(filtered, (item) => {
    const meta = kanjiReadingCache.get(item.kanji);
    const onJp = meta ? meta.onyomiJp.join(", ") : "загрузка...";
    const kunJp = meta ? meta.kunyomiJp.join(", ") : "загрузка...";
    const onRu = meta ? meta.onyomiRu.join(", ") : "загрузка...";
    const kunRu = meta ? meta.kunyomiRu.join(", ") : "загрузка...";
    const onEn = meta ? meta.onyomiEn.join(", ") : "загрузка...";
    const kunEn = meta ? meta.kunyomiEn.join(", ") : "загрузка...";
    return `
      <article class="card">
        <button class="kanji-click" data-kanji-id="${item.id}">${item.kanji}</button>
        <p><strong>Значение:</strong> ${escapeHTML(normalizeMeaningToRu(item.ru))}</p>
        <p><strong>Уровень:</strong> ${item.level} | <strong>Черт:</strong> ${item.strokes || "-"}</p>
        <p><strong>Чтение JP:</strong> On: ${escapeHTML(onJp)} | Kun: ${escapeHTML(kunJp)}</p>
        <p><strong>Чтение RU:</strong> On: ${escapeHTML(onRu)} | Kun: ${escapeHTML(kunRu)}</p>
        <p><strong>Чтение EN:</strong> On: ${escapeHTML(onEn)} | Kun: ${escapeHTML(kunEn)}</p>
        <button class="mark-btn" data-id="kanji:${item.id}">Я выучил(а)</button>
      </article>
    `;
  });
}

function extractKanjiChars(text) {
  return [...new Set(String(text || "").match(/[\u4E00-\u9FFF]/g) || [])];
}

function renderDictionary() {
  const direction = el.dictDirection.value;
  const q = el.dictSearch.value.trim().toLowerCase();
  const filtered = dictionaryData.filter((item) => {
    if (!q) return true;
    if (direction === "ru-jp") return `${item.ru}`.toLowerCase().includes(q);
    return `${item.jp} ${item.reading}`.toLowerCase().includes(q);
  });
  const chars = [...new Set(filtered.slice(0, DISPLAY_LIMIT).flatMap((x) => extractKanjiChars(x.jp)))];
  void preloadKanji(chars).then((changed) => { if (changed) renderDictionary(); });

  el.dictList.innerHTML = listWithLimitInfo(filtered, (item) => {
    const readingJp = item.reading || item.jp;
    const readingEn = toRomaji(readingJp);
    const readingRu = kanaToCyr(readingJp);
    const firstKanji = extractKanjiChars(item.jp)[0];
    const meta = firstKanji ? kanjiReadingCache.get(firstKanji) : null;
    const onKun = meta ? `${meta.onyomiJp.join(", ")} / ${meta.kunyomiJp.join(", ")}` : "загрузка...";
    return `
      <article class="card">
        <h4><button class="kanji-click word-click" data-word-id="${item.id}">${item.jp}</button> <small>${item.reading || "нет"}</small></h4>
        <p><strong>Перевод:</strong> ${escapeHTML(normalizeMeaningToRu(item.ru))}</p>
        <p><strong>Чтение JP:</strong> ${escapeHTML(readingJp)}</p>
        <p><strong>Чтение RU:</strong> ${escapeHTML(readingRu)}</p>
        <p><strong>Чтение EN:</strong> ${escapeHTML(readingEn)}</p>
        <p><strong>Onyomi/Kunyomi (1-й кандзи):</strong> ${escapeHTML(onKun)}</p>
        <div class="meta"><span class="badge">${item.level}</span></div>
        <button class="mark-btn" data-id="dict:${item.id}">Я выучил(а)</button>
      </article>
    `;
  });
}

function getQuizPool(mode) {
  if (quizCache[mode]) return quizCache[mode];
  let pool = [];
  if (mode === "grammar") {
    pool = grammarData.map((g) => ({ q: `Что значит ${g.pattern}?`, answer: g.ru, options: shuffle([g.ru, ...pickWrong(grammarData.map((x) => x.ru), g.ru)]) }));
  } else if (mode === "kanji") {
    const slice = kanjiData.slice(0, 1000);
    pool = slice.map((k) => ({ q: `Значение кандзи ${k.kanji}`, answer: normalizeMeaningToRu(k.ru), options: shuffle([normalizeMeaningToRu(k.ru), ...pickWrong(slice.map((x) => normalizeMeaningToRu(x.ru)), normalizeMeaningToRu(k.ru))]) }));
  } else {
    const slice = dictionaryData.slice(0, 2000);
    pool = slice.map((d) => ({ q: `Перевод слова ${d.jp}`, answer: normalizeMeaningToRu(d.ru), options: shuffle([normalizeMeaningToRu(d.ru), ...pickWrong(slice.map((x) => normalizeMeaningToRu(x.ru)), normalizeMeaningToRu(d.ru))]) }));
  }
  quizCache[mode] = pool;
  return pool;
}

function pickWrong(pool, answer, n = 3) {
  const unique = [...new Set(pool.filter((x) => x && x !== answer))];
  return shuffle(unique).slice(0, n);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderQuestion() {
  if (!trainerState) {
    if (el.quizFeedback) el.quizFeedback.textContent = "Сначала запустите урок из курса.";
    return;
  }
  if (!trainerState.answered) {
    if (el.quizFeedback) el.quizFeedback.textContent = "Сначала выберите ответ.";
    return;
  }
  trainerState.index += 1;
  renderTrainerQuestion();
}

function levelFromScore(score) {
  return Math.floor(score / 300) + 1;
}

function xpToNext(score) {
  const currentLevel = levelFromScore(score);
  const nextEdge = currentLevel * 300;
  return Math.max(0, nextEdge - score);
}

function buildDuoPath(learnedCount) {
  const stages = [
    "N5 Старт", "N5 База", "N4 Разгон", "N3 Середина", "N2 Продвинутый", "N1 Мастер"
  ];
  return stages.map((name, i) => {
    const unlocked = learnedCount >= i * 150;
    return `<div class="path-node ${unlocked ? "on" : "off"}">${name}</div>`;
  }).join("");
}

function refreshProfile() {
  if (currentUser === "guest") {
    if (el.currentUser) el.currentUser.textContent = "гость";
    if (el.learnedCount) el.learnedCount.textContent = "0";
    if (el.scoreCount) el.scoreCount.textContent = "0";
    if (el.profileName) el.profileName.textContent = "гость";
    if (el.profileCreated) el.profileCreated.textContent = "-";
    if (el.profileLearned) el.profileLearned.textContent = "0";
    if (el.profileScore) el.profileScore.textContent = "0";
    if (el.profileLevel) el.profileLevel.textContent = "1";
    if (el.profileXpToNext) el.profileXpToNext.textContent = "300";
    if (el.profileStreak) el.profileStreak.textContent = "0";
    if (el.profileHearts) el.profileHearts.textContent = "5";
    if (el.profileTodayXp) el.profileTodayXp.textContent = "0";
    if (el.profileDailyGoal) el.profileDailyGoal.textContent = "50";
    if (el.profileGoal) el.profileGoal.textContent = "войдите для сохранения";
    if (el.duoPath) el.duoPath.innerHTML = buildDuoPath(0);
    if (el.profileAvatar) el.profileAvatar.src = "https://placehold.co/96x96?text=G";
    return;
  }

  const user = getUserRecord();
  if (!user) return;
  ensureUser(user);

  const learned = Object.keys(user.progress.learned).length;
  const score = user.progress.score;
  const lvl = levelFromScore(score);

  if (el.currentUser) el.currentUser.textContent = currentUser;
  if (el.learnedCount) el.learnedCount.textContent = String(learned);
  if (el.scoreCount) el.scoreCount.textContent = String(score);

  if (el.profileName) el.profileName.textContent = currentUser;
  if (el.profileCreated) el.profileCreated.textContent = new Date(user.profile.createdAt).toLocaleDateString("ru-RU");
  if (el.profileLearned) el.profileLearned.textContent = String(learned);
  if (el.profileScore) el.profileScore.textContent = String(score);
  if (el.profileLevel) el.profileLevel.textContent = String(lvl);
  if (el.profileXpToNext) el.profileXpToNext.textContent = String(xpToNext(score));
  if (el.profileStreak) el.profileStreak.textContent = String(user.progress.streak);
  if (el.profileHearts) el.profileHearts.textContent = String(user.progress.hearts);
  if (el.profileDailyGoal) el.profileDailyGoal.textContent = String(user.profile.dailyGoal);
  if (el.profileTodayXp) el.profileTodayXp.textContent = String(user.progress.todayXp);
  if (el.profileGoal) el.profileGoal.textContent = user.profile.goal || "не задана";
  if (el.goalInput) el.goalInput.value = user.profile.goal || "";
  if (el.duoPath) el.duoPath.innerHTML = buildDuoPath(learned);

  if (el.profileAvatar) {
    el.profileAvatar.src = user.profile.photo || "https://placehold.co/96x96?text=JP";
  }
}

function withUserProgress(fn) {
  if (currentUser === "guest") return;
  const user = getUserRecord();
  if (!user) return;
  ensureUser(user);
  fn(user);
  saveUserRecord(user);
  refreshProfile();
}

function lessonModeByIndex(index) {
  const cycle = ["grammar", "kanji", "dictionary"];
  return cycle[index % cycle.length];
}

function buildLessonId(level, n) {
  return `${level}-L${String(n).padStart(3, "0")}`;
}

function getCourseData() {
  const totalLessons = LEVEL_ORDER.reduce((acc, level) => acc + COURSE_PLAN[level], 0);
  return { totalLessons };
}

function currentCourseState() {
  if (currentUser === "guest") {
    return { unlockedLevel: "N5", completedLessons: {} };
  }
  const user = getUserRecord();
  if (!user) return { unlockedLevel: "N5", completedLessons: {} };
  ensureUser(user);
  return user.progress.course;
}

function saveCourseState(nextState) {
  if (currentUser === "guest") return;
  withUserProgress((user) => {
    user.progress.course = nextState;
  });
}

function levelIndex(level) {
  return LEVEL_ORDER.indexOf(level);
}

function isLevelUnlocked(level, unlockedLevel) {
  return levelIndex(level) <= levelIndex(unlockedLevel);
}

function lessonsForLevel(level) {
  const count = COURSE_PLAN[level] || 0;
  return Array.from({ length: count }, (_, i) => ({
    id: buildLessonId(level, i + 1),
    level,
    index: i + 1,
    mode: lessonModeByIndex(i)
  }));
}

function generateLessonQuestions(mode, level, amount = 12) {
  let pool = [];
  if (mode === "grammar") {
    pool = grammarData.filter((x) => x.level === level);
    if (pool.length < amount) pool = grammarData.filter((x) => levelIndex(x.level) <= levelIndex(level));
    return shuffle(pool).slice(0, amount).map((g) => ({
      q: `Что означает: ${g.pattern}?`,
      answer: g.ru,
      options: shuffle([g.ru, ...pickWrong(grammarData.map((x) => x.ru), g.ru)])
    }));
  }
  if (mode === "kanji") {
    pool = kanjiData.filter((x) => x.level === level);
    if (pool.length < amount) pool = kanjiData.filter((x) => levelIndex(x.level) <= levelIndex(level));
    return shuffle(pool).slice(0, amount).map((k) => ({
      q: `Выберите значение кандзи: ${k.kanji}`,
      answer: normalizeMeaningToRu(k.ru),
      options: shuffle([normalizeMeaningToRu(k.ru), ...pickWrong(kanjiData.map((x) => normalizeMeaningToRu(x.ru)), normalizeMeaningToRu(k.ru))])
    }));
  }
  pool = dictionaryData.filter((x) => x.level === level);
  if (pool.length < amount) pool = dictionaryData.filter((x) => levelIndex(x.level) <= levelIndex(level));
  return shuffle(pool).slice(0, amount).map((d) => ({
    q: `Перевод слова ${d.jp} (${d.reading || "-"})`,
    answer: normalizeMeaningToRu(d.ru),
    options: shuffle([normalizeMeaningToRu(d.ru), ...pickWrong(dictionaryData.map((x) => normalizeMeaningToRu(x.ru)), normalizeMeaningToRu(d.ru))])
  }));
}

function lessonProgress(level, completedLessons) {
  const total = COURSE_PLAN[level] || 1;
  let done = 0;
  for (let i = 1; i <= total; i += 1) {
    if (completedLessons[buildLessonId(level, i)]) done += 1;
  }
  return { done, total, percent: Math.floor((done / total) * 100) };
}

function unlockNextLevelIfNeeded(state) {
  const unlocked = state.unlockedLevel;
  const prog = lessonProgress(unlocked, state.completedLessons);
  if (prog.done < prog.total) return state;
  const idx = levelIndex(unlocked);
  if (idx < LEVEL_ORDER.length - 1) {
    return { ...state, unlockedLevel: LEVEL_ORDER[idx + 1] };
  }
  return state;
}

function renderCourse() {
  if (!el.courseLessons) return;
  const state = currentCourseState();
  const all = LEVEL_ORDER.flatMap((level) => lessonsForLevel(level));
  const completedCount = Object.keys(state.completedLessons || {}).length;
  const { totalLessons } = getCourseData();
  const levelProg = lessonProgress(state.unlockedLevel, state.completedLessons);

  if (el.courseUnlockedLevel) el.courseUnlockedLevel.textContent = state.unlockedLevel;
  if (el.courseCompletedCount) el.courseCompletedCount.textContent = String(completedCount);
  if (el.courseTotalCount) el.courseTotalCount.textContent = String(totalLessons);
  if (el.courseLevelProgress) el.courseLevelProgress.textContent = `${levelProg.percent}%`;

  el.courseLessons.innerHTML = all.slice(0, 240).map((lesson) => {
    const unlocked = isLevelUnlocked(lesson.level, state.unlockedLevel);
    const done = !!state.completedLessons[lesson.id];
    const cls = done ? "on" : (unlocked ? "off" : "locked");
    const label = done ? "Пройден" : (unlocked ? "Начать" : "Закрыт");
    return `
      <div class="path-node ${cls}">
        <strong>${lesson.id}</strong> - ${lesson.level} - ${lesson.mode}
        <button class="mark-btn lesson-start" data-lesson-id="${lesson.id}" ${unlocked ? "" : "disabled"}>${label}</button>
      </div>
    `;
  }).join("");
}

function startLesson(lessonId) {
  const [level] = lessonId.split("-L");
  const idx = Number(lessonId.split("-L")[1] || "1");
  const mode = lessonModeByIndex((idx - 1) % 3);
  const questions = generateLessonQuestions(mode, level, 12);
  trainerState = { lessonId, level, mode, questions, index: 0, correct: 0, answered: false };
  renderTrainerQuestion();
}

function finishLesson() {
  if (!trainerState) return;
  const passed = trainerState.correct >= Math.ceil(trainerState.questions.length * 0.75);
  if (passed) {
    const state = currentCourseState();
    if (!state.completedLessons[trainerState.lessonId]) {
      state.completedLessons[trainerState.lessonId] = true;
      addXP(40);
    }
    const next = unlockNextLevelIfNeeded(state);
    saveCourseState(next);
    if (el.quizFeedback) el.quizFeedback.textContent = `Урок пройден! ${trainerState.correct}/${trainerState.questions.length}`;
  } else if (el.quizFeedback) {
    el.quizFeedback.textContent = `Недостаточно. ${trainerState.correct}/${trainerState.questions.length}. Повторите урок.`;
  }
  trainerState = null;
  if (el.nextQuestion) el.nextQuestion.style.display = "none";
  refreshProfile();
  renderCourse();
}

function renderTrainerQuestion() {
  if (!trainerState || !el.quizTitle || !el.quizOptions || !el.quizProgress || !el.quizFeedback) return;
  const item = trainerState.questions[trainerState.index];
  if (!item) {
    finishLesson();
    return;
  }
  el.quizTitle.textContent = `${trainerState.lessonId}: ${item.q}`;
  el.quizProgress.textContent = `${trainerState.index + 1} / ${trainerState.questions.length}`;
  el.quizFeedback.textContent = "";
  el.quizOptions.innerHTML = item.options.map((opt) => `<button class="quiz-option" data-correct="${String(opt === item.answer)}">${opt}</button>`).join("");
  if (el.nextQuestion) el.nextQuestion.style.display = "none";
  trainerState.answered = false;
}

function handleAvatarUpload(file) {
  if (!file || currentUser === "guest") return;
  const reader = new FileReader();
  reader.onload = () => {
    const user = getUserRecord();
    if (!user) return;
    user.profile.photo = String(reader.result || "");
    saveUserRecord(user);
    refreshProfile();
  };
  reader.readAsDataURL(file);
}

function clearAvatar() {
  if (currentUser === "guest") return;
  const user = getUserRecord();
  if (!user) return;
  user.profile.photo = "";
  saveUserRecord(user);
  refreshProfile();
}

function kanjiHex(kanji) {
  const cp = kanji.codePointAt(0);
  return cp ? cp.toString(16).padStart(5, "0") : "00000";
}

async function loadStrokeSvg(kanji) {
  if (strokeSvgCache.has(kanji)) return strokeSvgCache.get(kanji);
  const res = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${kanjiHex(kanji)}.svg`);
  if (!res.ok) throw new Error(`KanjiVG ${res.status}`);
  const text = await res.text();
  const clean = text.replace(/<\?xml[^>]*>/g, "").replace(/<!DOCTYPE[^>]*>/g, "").replace(/id="[^"]*"/g, "");
  strokeSvgCache.set(kanji, clean);
  return clean;
}

async function openKanjiModal(item) {
  if (!item) return;
  el.kanjiModalTitle.textContent = `${item.kanji} (${item.level})`;
  el.kanjiModalBody.innerHTML = "<p>Загрузка...</p>";
  el.kanjiModal.classList.add("open");
  try {
    const [svg, info] = await Promise.all([loadStrokeSvg(item.kanji), loadKanjiInfo(item.kanji).catch(() => null)]);
    const meta = buildReadingMeta(info);
    kanjiReadingCache.set(item.kanji, meta);
    const allMeanings = info && Array.isArray(info.meanings) && info.meanings.length
      ? info.meanings
      : splitMeanings(item.ru);
    el.kanjiModalBody.innerHTML = `
      <div class="kanji-grid">
        <section class="stroke-box">
          <div class="kanji-svg-wrap">${svg}</div>
          <p class="stroke-note">Правильный порядок черт (KanjiVG)</p>
        </section>
        <section class="stroke-box">
          <p><strong>Основное значение:</strong> ${escapeHTML(normalizeMeaningToRu(item.ru))}</p>
          <p><strong>Все значения:</strong></p>
          ${meaningListHTML(allMeanings)}
          <p><strong>Onyomi JP:</strong> ${escapeHTML(meta.onyomiJp.join(", "))}</p>
          <p><strong>Kunyomi JP:</strong> ${escapeHTML(meta.kunyomiJp.join(", "))}</p>
          <p><strong>Onyomi RU:</strong> ${escapeHTML(meta.onyomiRu.join(", "))}</p>
          <p><strong>Kunyomi RU:</strong> ${escapeHTML(meta.kunyomiRu.join(", "))}</p>
          <p><strong>Onyomi EN:</strong> ${escapeHTML(meta.onyomiEn.join(", "))}</p>
          <p><strong>Kunyomi EN:</strong> ${escapeHTML(meta.kunyomiEn.join(", "))}</p>
        </section>
      </div>
    `;
    renderKanji();
  } catch (e) {
    el.kanjiModalBody.innerHTML = `<article class="card"><p>Ошибка загрузки: ${escapeHTML(e.message || e)}</p></article>`;
  }
}

function openWordModal(item) {
  if (!item || !el.wordModal || !el.wordModalBody || !el.wordModalTitle) return;
  const readingJp = item.reading || item.jp;
  const readingEn = toRomaji(readingJp);
  const readingRu = kanaToCyr(readingJp);
  const meanings = splitMeanings(item.ru);

  el.wordModalTitle.textContent = `${item.jp} (${item.level})`;
  el.wordModalBody.innerHTML = `
    <section class="stroke-box">
      <p><strong>Слово:</strong> ${escapeHTML(item.jp)}</p>
      <p><strong>Чтение JP:</strong> ${escapeHTML(readingJp)}</p>
      <p><strong>Чтение RU:</strong> ${escapeHTML(readingRu)}</p>
      <p><strong>Чтение EN:</strong> ${escapeHTML(readingEn)}</p>
      <p><strong>Тема:</strong> ${escapeHTML(item.topic || "jlpt")}</p>
      <p><strong>Все значения:</strong></p>
      ${meaningListHTML(meanings)}
    </section>
  `;
  el.wordModal.classList.add("open");
}

function initTabs() {
  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      el.tabs.forEach((t) => t.classList.remove("active"));
      el.panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "grammar") renderGrammar();
      if (tab.dataset.tab === "kanji") renderKanji();
      if (tab.dataset.tab === "dictionary") renderDictionary();
      if (tab.dataset.tab === "trainer") renderCourse();
      if (tab.dataset.tab === "profile") refreshProfile();
    });
  });
}

function initEvents() {
  [el.grammarLevel, el.grammarSearch].forEach((n) => n.addEventListener("input", renderGrammar));
  [el.kanjiLevel, el.kanjiSearch].forEach((n) => n.addEventListener("input", renderKanji));
  [el.dictDirection, el.dictSearch].forEach((n) => n.addEventListener("input", renderDictionary));
  if (el.nextQuestion) el.nextQuestion.addEventListener("click", renderQuestion);

  el.reset.addEventListener("click", () => {
    withUserProgress((user) => {
      user.progress.learned = {};
      user.progress.score = 0;
      user.progress.streak = 0;
      user.progress.todayXp = 0;
      user.progress.course = { unlockedLevel: "N5", completedLessons: {} };
    });
    trainerState = null;
    if (el.nextQuestion) el.nextQuestion.style.display = "none";
    renderGrammar();
    renderKanji();
    renderDictionary();
    renderCourse();
  });

  el.logoutBtn.addEventListener("click", () => {
    clearSession();
    window.location.href = "./auth.html";
  });

  el.saveGoalBtn.addEventListener("click", () => {
    withUserProgress((user) => {
      user.profile.goal = String(el.goalInput.value || "").trim();
    });
  });

  el.avatarInput.addEventListener("change", () => {
    const file = el.avatarInput.files && el.avatarInput.files[0];
    handleAvatarUpload(file);
  });

  el.removeAvatarBtn.addEventListener("click", clearAvatar);

  el.kanjiModalClose.addEventListener("click", () => el.kanjiModal.classList.remove("open"));
  el.kanjiModal.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.id === "kanjiModal") {
      el.kanjiModal.classList.remove("open");
    }
  });
  if (el.wordModalClose) {
    el.wordModalClose.addEventListener("click", () => el.wordModal.classList.remove("open"));
  }
  if (el.wordModal) {
    el.wordModal.addEventListener("click", (e) => {
      if (e.target instanceof HTMLElement && e.target.id === "wordModal") {
        el.wordModal.classList.remove("open");
      }
    });
  }

  document.body.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches(".lesson-start")) {
      const lessonId = String(target.dataset.lessonId || "");
      if (lessonId) startLesson(lessonId);
      return;
    }

    if (target.matches(".mark-btn")) {
      const id = target.dataset.id;
      if (!id) return;
      markLearned(id);
      target.textContent = "Отмечено";
    }

    if (target.matches(".kanji-click")) {
      const id = target.dataset.kanjiId;
      if (!id) return;
      const item = kanjiData.find((x) => String(x.id) === String(id));
      if (item) openKanjiModal(item);
    }

    if (target.matches(".word-click")) {
      const id = target.dataset.wordId;
      if (!id) return;
      const item = dictionaryById.get(String(id));
      if (item) openWordModal(item);
    }

    if (target.matches(".quiz-option")) {
      if (!trainerState) return;
      if (trainerState.answered) return;
      trainerState.answered = true;

      const correct = target.dataset.correct === "true";
      [...el.quizOptions.querySelectorAll(".quiz-option")].forEach((btn) => { btn.disabled = true; });

      if (correct) {
        trainerState.correct += 1;
        addXP(10);
        el.quizFeedback.textContent = "Верно! +10 XP";
      } else {
        el.quizFeedback.textContent = "Неверно. Нажмите «Следующий вопрос».";
      }
      if (el.nextQuestion) el.nextQuestion.style.display = "inline-flex";
      refreshProfile();
    }
  });
}

function init() {
  if (!requireAuth()) return;

  fillLevelSelect(el.grammarLevel);
  fillLevelSelect(el.kanjiLevel);
  initTabs();
  initEvents();
  renderKana();
  renderGrammar();
  renderKanji();
  renderDictionary();
  renderCourse();
  if (el.quizTitle) el.quizTitle.textContent = "Выберите урок в курсе слева";
  if (el.quizProgress) el.quizProgress.textContent = "0 / 0";
  if (el.quizOptions) el.quizOptions.innerHTML = "";
  if (el.quizFeedback) el.quizFeedback.textContent = "";
  if (el.nextQuestion) el.nextQuestion.style.display = "none";
  refreshProfile();
}

init();
