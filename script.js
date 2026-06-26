/* ============================================================
   KS3 Reading Fluency Assessment — front-end logic
   ============================================================ */

/* ----------------------------------------------------------------
   1. CONFIGURE THIS: your deployed Cloudflare Worker URL.
   After you deploy the Worker (see README), paste its URL here.
   Example: "https://reading-fluency-worker.your-name.workers.dev"
   ---------------------------------------------------------------- */
const WORKER_URL = "https://REPLACE-ME.workers.dev";

/* ----------------------------------------------------------------
   2. Assessment items + the advice shown when "Challenging" is picked.
   The "key" matches the spreadsheet column names in the README.
   ---------------------------------------------------------------- */
const ITEMS = [
  {
    key: "TrickyWords",
    label: "Tricky Words / Exceptions",
    advice:
      "Practise high-frequency exception words through repeated reading, quick recognition drills, and sentence-level practice. Focus on words that cannot be decoded in the usual way.",
  },
  {
    key: "SplitDigraphs",
    label: "Split digraphs",
    advice:
      "Revisit split digraph patterns such as a-e, i-e, o-e and u-e. Use word sorting, oral blending and short reading drills to build automatic recognition.",
  },
  {
    key: "ComplexGraphemes",
    label: "Trigraphs and complex graphemes",
    advice:
      "Practise complex sound-spelling correspondences in isolation and then in connected text. Ask the student to identify, underline and reread words containing these patterns.",
  },
  {
    key: "PolysyllabicWords",
    label: "Polysyllabic words",
    advice:
      "Teach the student to split longer words into syllables and meaningful chunks. Practise reading the word slowly, then smoothly, then in a full sentence.",
  },
  {
    key: "Morphology",
    label: "Morphology: prefixes/suffixes",
    advice:
      "Focus on prefixes, suffixes and root words. Show how word parts change meaning and pronunciation, then practise with related word families.",
  },
  {
    key: "Prosody",
    label: "Prosody: intonation, stress, rhythm, pauses",
    advice:
      "Model fluent reading aloud, then ask the student to echo-read. Focus on phrasing, pauses, stress and expression rather than speed alone.",
  },
];

/* Holds the current selection for each item: "Fluent" | "Challenging" | null */
const selections = {};
ITEMS.forEach((item) => (selections[item.key] = null));

/* ----------------------------------------------------------------
   3. Build the assessment rows
   ---------------------------------------------------------------- */
const itemList = document.getElementById("itemList");

ITEMS.forEach((item) => {
  const row = document.createElement("div");
  row.className = "item-row";
  row.dataset.key = item.key;

  const label = document.createElement("div");
  label.className = "item-label";
  label.textContent = item.label;

  const buttons = document.createElement("div");
  buttons.className = "item-buttons";

  const greenBtn = makeChoiceButton(item, "green", "Fluent");
  const redBtn = makeChoiceButton(item, "red", "Challenging");

  buttons.appendChild(greenBtn);
  buttons.appendChild(redBtn);

  row.appendChild(label);
  row.appendChild(buttons);
  itemList.appendChild(row);

  // Advice box (hidden until "Challenging" is selected)
  const advice = document.createElement("div");
  advice.className = "advice";
  advice.id = "advice-" + item.key;
  advice.hidden = true;
  advice.innerHTML = "<strong>Try this:</strong> " + item.advice;
  itemList.appendChild(advice);
});

function makeChoiceButton(item, colour, value) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "choice " + colour;
  btn.setAttribute(
    "aria-label",
    item.label + " — " + value
  );
  btn.innerHTML = '<span class="ring"></span>';

  btn.addEventListener("click", () => {
    selections[item.key] = value;

    // Update selected styling for this row only
    const row = btn.closest(".item-row");
    row.querySelectorAll(".choice").forEach((c) => c.classList.remove("selected"));
    btn.classList.add("selected");

    // Show advice immediately for "Challenging", hide for "Fluent"
    const advice = document.getElementById("advice-" + item.key);
    advice.hidden = value !== "Challenging";

    validate();
  });

  return btn;
}

/* ----------------------------------------------------------------
   4. Auto date/time
   ---------------------------------------------------------------- */
function nowReadable() {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
document.getElementById("timestamp").value = nowReadable();

/* ----------------------------------------------------------------
   5. Validation — submit only enabled when the three names are filled
   ---------------------------------------------------------------- */
const studentNameEl = document.getElementById("studentName");
const tutorGroupEl = document.getElementById("tutorGroup");
const assessorEl = document.getElementById("assessor");
const submitBtn = document.getElementById("submitBtn");
const validationMessage = document.getElementById("validationMessage");

function formReady() {
  return (
    studentNameEl.value.trim() &&
    tutorGroupEl.value.trim() &&
    assessorEl.value.trim()
  );
}

function validate() {
  submitBtn.disabled = !formReady();
  if (formReady()) validationMessage.textContent = "";
}

[studentNameEl, tutorGroupEl, assessorEl].forEach((el) =>
  el.addEventListener("input", validate)
);

/* ----------------------------------------------------------------
   6. Submit
   ---------------------------------------------------------------- */
submitBtn.addEventListener("click", submitAssessment);

async function submitAssessment() {
  if (!formReady()) {
    validationMessage.textContent =
      "Please complete student name, tutor group and assessor name.";
    return;
  }

  // Build the payload. Unselected items become "Not assessed".
  const payload = {
    Timestamp: new Date().toISOString(),
    TimestampReadable: nowReadable(),
    StudentName: studentNameEl.value.trim(),
    TutorGroup: tutorGroupEl.value.trim(),
    Assessor: assessorEl.value.trim(),
  };

  const adviceParts = [];
  ITEMS.forEach((item) => {
    const value = selections[item.key] || "Not assessed";
    payload[item.key] = value;
    if (value === "Challenging") {
      adviceParts.push(item.label + ": " + item.advice);
    }
  });

  payload.AdviceGenerated = adviceParts.join(" | ");

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";
  validationMessage.textContent = "";

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("Server responded " + res.status + ". " + text);
    }

    showConfirmation(payload);
  } catch (err) {
    validationMessage.textContent =
      "Could not save the assessment. Please check your connection and try again.";
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit assessment";
  }
}

/* ----------------------------------------------------------------
   7. Confirmation + reset
   ---------------------------------------------------------------- */
function showConfirmation(payload) {
  const confirmation = document.getElementById("confirmation");
  document.getElementById("confirmationText").textContent =
    "Saved for " + payload.StudentName + " (" + payload.TutorGroup + ").";
  confirmation.style.display = "flex";
}

document.getElementById("newAssessmentBtn").addEventListener("click", () => {
  // Simplest reliable reset for a tablet workflow: reload the page.
  window.location.reload();
});
