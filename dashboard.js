const themes = 3;
const quotes = [
  ["Clarity comes from engagement, not thought.", "Marie Forleo"],
  ["The secret of getting ahead is getting started.", "Mark Twain"],
  ["Focus is the art of knowing what to ignore.", "James Clear"],
  ["Small steps every day become remarkable results.", "Unknown"],
  ["What you do today can improve all your tomorrows.", "Ralph Marston"]
];

const $ = (id) => document.getElementById(id);
let themeIndex = Number(localStorage.getItem("aurora-theme"));
if (!Number.isInteger(themeIndex) || themeIndex < 0 || themeIndex >= themes) {
  themeIndex = new Date().getDate() % themes;
}

function applyTheme() {
  $("background").className = `background theme-${themeIndex}`;
  localStorage.setItem("aurora-theme", String(themeIndex));
}

function updateClock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  $("date").textContent = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  const hour = now.getHours();
  $("greeting").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function renderName() {
  $("name").textContent = localStorage.getItem("aurora-name") || "friend";
}

function renderFocus() {
  const focus = localStorage.getItem("aurora-focus");
  const completed = localStorage.getItem("aurora-focus-completed") === "true";
  $("focusForm").classList.toggle("hidden", Boolean(focus));
  $("focusSaved").classList.toggle("hidden", !focus);
  $("focusSaved").classList.toggle("completed", completed);
  $("focusText").textContent = focus || "";
}

function renderQuote() {
  const [quote, author] = quotes[new Date().getDate() % quotes.length];
  $("quote").textContent = `“${quote}”`;
  $("quoteAuthor").textContent = `— ${author}`;
}

function getTasks() {
  try {
    return JSON.parse(localStorage.getItem("aurora-tasks")) || [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem("aurora-tasks", JSON.stringify(tasks));
  renderTasks();
}

function renderTasks() {
  const tasks = getTasks();
  const completed = tasks.filter((task) => task.done).length;
  $("taskCount").textContent = `${completed} / ${tasks.length}`;
  $("emptyTasks").classList.toggle("hidden", tasks.length > 0);
  $("todoList").replaceChildren(...tasks.map((task) => {
    const item = document.createElement("li");
    item.className = `todo-item${task.done ? " done" : ""}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", `Complete ${task.text}`);
    checkbox.addEventListener("change", () => {
      const next = getTasks();
      const found = next.find((entry) => entry.id === task.id);
      if (found) found.done = checkbox.checked;
      saveTasks(next);
    });
    const text = document.createElement("span");
    text.textContent = task.text;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-task";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${task.text}`);
    remove.addEventListener("click", () => saveTasks(getTasks().filter((entry) => entry.id !== task.id)));
    item.append(checkbox, text, remove);
    return item;
  }));
}

let selectedMinutes = 25;
let secondsRemaining = selectedMinutes * 60;
let timerInterval = null;
let timerEnd = 0;
let audioContext = null;
let soundNodes = [];

function renderTimer() {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  $("timer").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  document.title = timerInterval ? `${$("timer").textContent} · Aurora Focus` : "Aurora Dashboard";
}

function stopTimer(finished = false) {
  clearInterval(timerInterval);
  timerInterval = null;
  $("startTimer").textContent = "Start";
  if (finished) {
    secondsRemaining = 0;
    $("focusGoal").textContent = "Session complete — well done.";
    playCompletionTone();
  }
  renderTimer();
}

function tickTimer() {
  secondsRemaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
  renderTimer();
  if (secondsRemaining === 0) stopTimer(true);
}

function startOrPauseTimer() {
  if (timerInterval) {
    tickTimer();
    clearInterval(timerInterval);
    timerInterval = null;
    $("startTimer").textContent = "Resume";
    return;
  }
  if (secondsRemaining <= 0) secondsRemaining = selectedMinutes * 60;
  timerEnd = Date.now() + secondsRemaining * 1000;
  timerInterval = setInterval(tickTimer, 250);
  $("startTimer").textContent = "Pause";
  tickTimer();
}

function stopSound() {
  soundNodes.forEach((node) => {
    try { node.stop?.(); } catch {}
    try { node.disconnect?.(); } catch {}
  });
  soundNodes = [];
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

function noiseBuffer(context, brown = false) {
  const length = context.sampleRate * 3;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = brown ? (last + 0.02 * white) / 1.02 : white;
    data[i] = brown ? last * 3.5 : white;
  }
  return buffer;
}

function setSound(type) {
  stopSound();
  if (type === "off") return;
  audioContext = new AudioContext();
  const master = audioContext.createGain();
  master.gain.value = type === "music" ? 0.055 : 0.08;
  master.connect(audioContext.destination);
  soundNodes.push(master);
  if (type === "rain" || type === "brown") {
    const source = audioContext.createBufferSource();
    source.buffer = noiseBuffer(audioContext, type === "brown");
    source.loop = true;
    const filter = audioContext.createBiquadFilter();
    filter.type = type === "rain" ? "highpass" : "lowpass";
    filter.frequency.value = type === "rain" ? 900 : 420;
    source.connect(filter).connect(master);
    source.start();
    soundNodes.push(source, filter);
    return;
  }
  [130.81, 196, 261.63, 329.63].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index % 2 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.5 : 0.18;
    oscillator.connect(gain).connect(master);
    oscillator.start();
    soundNodes.push(oscillator, gain);
  });
}

function playCompletionTone() {
  const context = new AudioContext();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.12, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.3);
  gain.connect(context.destination);
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.14);
    oscillator.stop(context.currentTime + 1.3);
  });
  setTimeout(() => context.close(), 1600);
}

$("changeBackground").addEventListener("click", () => {
  themeIndex = (themeIndex + 1) % themes;
  applyTheme();
});

$("nameButton").addEventListener("click", () => {
  $("nameInput").value = localStorage.getItem("aurora-name") || "";
  $("nameDialog").showModal();
  $("nameInput").focus();
});

$("cancelName").addEventListener("click", () => $("nameDialog").close());

$("nameForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("nameInput").value.trim();
  if (value) localStorage.setItem("aurora-name", value);
  else localStorage.removeItem("aurora-name");
  $("nameDialog").close();
  renderName();
});

$("focusForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("focusInput").value.trim();
  if (!value) return;
  localStorage.setItem("aurora-focus", value);
  localStorage.setItem("aurora-focus-completed", "false");
  $("focusInput").value = "";
  renderFocus();
});

$("completeFocus").addEventListener("click", () => {
  const completed = localStorage.getItem("aurora-focus-completed") === "true";
  localStorage.setItem("aurora-focus-completed", String(!completed));
  renderFocus();
});

$("editFocus").addEventListener("click", () => {
  $("focusInput").value = localStorage.getItem("aurora-focus") || "";
  localStorage.removeItem("aurora-focus");
  localStorage.removeItem("aurora-focus-completed");
  renderFocus();
  $("focusInput").focus();
});

$("todoForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = $("todoInput").value.trim();
  if (!text) return;
  saveTasks([...getTasks(), { id: crypto.randomUUID(), text, done: false }]);
  $("todoInput").value = "";
});

$("openFocus").addEventListener("click", async () => {
  $("focusGoal").textContent = localStorage.getItem("aurora-focus") || "Stay with the task";
  $("focusOverlay").classList.remove("hidden");
  try { await document.documentElement.requestFullscreen(); } catch {}
});

$("exitFocus").addEventListener("click", async () => {
  stopTimer();
  stopSound();
  $("focusOverlay").classList.add("hidden");
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch {}
  }
});

$("timerPresets").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-minutes]");
  if (!button || timerInterval) return;
  selectedMinutes = Number(button.dataset.minutes);
  secondsRemaining = selectedMinutes * 60;
  document.querySelectorAll("#timerPresets button").forEach((item) => item.classList.toggle("active", item === button));
  renderTimer();
});

$("startTimer").addEventListener("click", startOrPauseTimer);
$("resetTimer").addEventListener("click", () => {
  stopTimer();
  secondsRemaining = selectedMinutes * 60;
  $("focusGoal").textContent = localStorage.getItem("aurora-focus") || "Stay with the task";
  renderTimer();
});
$("soundSelect").addEventListener("change", (event) => setSound(event.target.value));

applyTheme();
updateClock();
renderName();
renderFocus();
renderQuote();
renderTasks();
renderTimer();
setInterval(updateClock, 1000);
