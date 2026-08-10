// ============================================================
// CONFIG
// ============================================================
// Point this at wherever your FastAPI app is running.
const API_BASE_URL = "https://nyc-airbnb-room-type-predictor-qt8g.onrender.com";
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;
const HEALTH_ENDPOINT = `${API_BASE_URL}/`;

const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Room type classes the model returns, paired with a subway-line
// color used for the bullet dot on the arrivals board.
const ROOM_CLASSES = [
  { key: "Entire home/apt", label: "Entire home/apt", dot: "g" },
  { key: "Private room", label: "Private room", dot: "b" },
  { key: "Shared room", label: "Shared room", dot: "o" },
];

// A few realistic example listings so people can explore without typing.
const EXAMPLES = [
  {
    latitude: 40.7484, longitude: -73.9857, price: 120, minimum_nights: 2,
    number_of_reviews: 84, reviews_per_month: 2.3, calculated_host_listings_count: 1,
    availability_365: 210, neighbourhood_group: "Manhattan", neighbourhood: "Midtown",
  },
  {
    latitude: 40.6782, longitude: -73.9442, price: 55, minimum_nights: 1,
    number_of_reviews: 210, reviews_per_month: 4.1, calculated_host_listings_count: 3,
    availability_365: 300, neighbourhood_group: "Brooklyn", neighbourhood: "Bedford-Stuyvesant",
  },
  {
    latitude: 40.7282, longitude: -73.7949, price: 38, minimum_nights: 3,
    number_of_reviews: 12, reviews_per_month: 0.6, calculated_host_listings_count: 1,
    availability_365: 90, neighbourhood_group: "Queens", neighbourhood: "Flushing",
  },
];
let exampleIndex = 0;

// ============================================================
// STATION CLOCK — small ambient touch on the board header
// ============================================================
function tickClock() {
  const el = document.getElementById("boardClock");
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  el.textContent = `${hh}:${mm}:${ss}`;
}

// ============================================================
// FORM WIRING
// ============================================================
const form = document.getElementById("predictForm");
const predictBtn = document.getElementById("predictBtn");
const formError = document.getElementById("formError");
const availabilityInput = document.getElementById("availability_365");
const availabilityValue = document.getElementById("availabilityValue");
const exampleBtn = document.getElementById("exampleBtn");

availabilityInput.addEventListener("input", () => {
  availabilityValue.textContent = availabilityInput.value;
});

exampleBtn.addEventListener("click", () => {
  const data = EXAMPLES[exampleIndex % EXAMPLES.length];
  exampleIndex++;
  Object.entries(data).forEach(([key, value]) => {
    const el = form.elements[key];
    if (el) el.value = value;
  });
  availabilityValue.textContent = data.availability_365;
  formError.textContent = "";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  if (!form.reportValidity()) return;

  const payload = collectPayload();
  setLoading(true);

  try {
    const res = await fetch(PREDICT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error("API ERROR STATUS:", res.status);
      console.error("API ERROR BODY:", body);
      console.error("SENT PAYLOAD:", payload);
      throw new Error(
        body?.detail ? formatDetail(body.detail) : `Request failed (${res.status}).`
      );
    }

    const result = await res.json();
    renderResult(result);
  } catch (err) {
    formError.textContent = err.message?.includes("fetch")
      ? "Can't reach the prediction API. Make sure the FastAPI server is running and reachable."
      : err.message || "Something went wrong. Check the values and try again.";
  } finally {
    setLoading(false);
  }
});

function collectPayload() {
  const fd = new FormData(form);
  return {
    latitude: parseFloat(fd.get("latitude")),
    longitude: parseFloat(fd.get("longitude")),
    price: parseFloat(fd.get("price")),
    minimum_nights: parseInt(fd.get("minimum_nights"), 10),
    number_of_reviews: parseInt(fd.get("number_of_reviews"), 10),
    reviews_per_month: parseFloat(fd.get("reviews_per_month")),
    calculated_host_listings_count: parseInt(fd.get("calculated_host_listings_count"), 10),
    availability_365: parseInt(fd.get("availability_365"), 10),
    neighbourhood_group: fd.get("neighbourhood_group"),
    neighbourhood: fd.get("neighbourhood"),
  };
}

function formatDetail(detail) {
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(" ");
  }
  return String(detail);
}

function setLoading(isLoading) {
  predictBtn.disabled = isLoading;
  predictBtn.classList.toggle("loading", isLoading);
}

// ============================================================
// RESULT RENDERING — the arrivals board
// ============================================================
const resultEmpty = document.getElementById("resultEmpty");
const resultContent = document.getElementById("resultContent");
const predictedName = document.getElementById("predictedName");
const boardRows = document.getElementById("boardRows");

function renderResult(result) {
  const predicted = result.Predicted_room_type;
  const probs = result.Probability; // array aligned to model.classes_ order

  // Pair each class with its probability. We trust ROOM_CLASSES order
  // matches sklearn's alphabetical classes_ output; fall back gracefully
  // if lengths mismatch.
  const paired = ROOM_CLASSES.map((cls, i) => ({
    ...cls,
    prob: typeof probs?.[i] === "number" ? probs[i] : 0,
  })).sort((a, b) => b.prob - a.prob);

  resultEmpty.hidden = true;
  resultContent.hidden = false;

  predictedName.textContent = predicted;

  buildBoardRows(paired, predicted);
}

function buildBoardRows(paired, predicted) {
  boardRows.innerHTML = "";

  paired.forEach((cls) => {
    const row = document.createElement("div");
    row.className = "board-row" + (cls.key === predicted ? " top" : "");

    const dot = document.createElement("span");
    dot.className = `dot ${cls.dot}`;

    const label = document.createElement("span");
    label.className = "r-label";
    label.textContent = cls.label;

    const bar = document.createElement("span");
    bar.className = "r-bar";
    const fill = document.createElement("span");
    bar.appendChild(fill);

    const pct = document.createElement("span");
    pct.className = "r-pct";
    pct.textContent = "0%";

    row.appendChild(dot);
    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(pct);
    boardRows.appendChild(row);

    const target = Math.round(cls.prob * 100);
    requestAnimationFrame(() => {
      setTimeout(() => {
        fill.style.width = `${target}%`;
        animateCount(pct, target);
      }, REDUCE_MOTION ? 0 : 150);
    });
  });
}

function animateCount(el, target) {
  if (REDUCE_MOTION) {
    el.textContent = `${target}%`;
    return;
  }
  const duration = 700;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = `${Math.round(target * eased)}%`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ============================================================
// API HEALTH CHECK
// ============================================================
async function checkApiStatus() {
  const statusEl = document.getElementById("apiStatus");
  try {
    const res = await fetch(HEALTH_ENDPOINT, { method: "GET" });
    if (res.ok) {
      statusEl.classList.add("online");
      statusEl.classList.remove("offline");
      statusEl.lastChild.textContent = "API connected";
    } else {
      throw new Error("bad status");
    }
  } catch {
    statusEl.classList.add("offline");
    statusEl.classList.remove("online");
    statusEl.lastChild.textContent = "API unreachable";
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  checkApiStatus();
  tickClock();
  setInterval(tickClock, 1000);
});