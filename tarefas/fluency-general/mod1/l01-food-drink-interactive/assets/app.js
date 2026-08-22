(() => {
  "use strict";

  const data = window.EXERCISE_DATA;
  if (!data) throw new Error("EXERCISE_DATA is missing.");

  const state = { answers: {}, completed: false, score: null, firstAccessAt: null, completedAt: null, attempts: 0 };
  const helpStages = {};
  let saveTimer;

  const shell = document.getElementById("exerciseShell");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const autosaveText = document.getElementById("autosaveText");
  const submitButton = document.getElementById("submitButton");
  const summary = document.getElementById("completionSummary");
  const resultsModal = document.getElementById("resultsModal");
  const resultScore = document.getElementById("resultScore");
  const resultCorrect = document.getElementById("resultCorrect");
  const resultTotal = document.getElementById("resultTotal");
  const resultGrade = document.getElementById("resultGrade");
  const resultBreakdown = document.getElementById("resultBreakdown");
  const resultSaveNote = document.getElementById("resultSaveNote");
  const iviLauncher = document.getElementById("iviLauncher");
  const iviPanel = document.getElementById("iviPanel");
  const iviExercise = document.getElementById("iviExercise");
  const iviMessages = document.getElementById("iviMessages");
  const iviQuestion = document.getElementById("iviQuestion");
  const storageKey = `fluency:${data.firestorePath}`;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node && value != null && value !== "") node.textContent = value;
  }

  function normalize(value, strict = false) {
    let result = String(value || "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/…/g, "...")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    if (!strict) result = result.replace(/[.!?]+$/, "");
    return result;
  }

  function controlValue(control) {
    if (control.type === "radio") {
      const selected = document.querySelector(`[data-answer-key="${control.dataset.answerKey}"]:checked`);
      return selected ? selected.value : "";
    }
    return control.value;
  }

  function isCorrect(control) {
    const answers = JSON.parse(control.dataset.answers || "[]");
    const strict = control.dataset.strict === "true";
    return answers.some(answer => normalize(answer, strict) === normalize(controlValue(control), strict));
  }

  function setFeedback(control, show = true) {
    const wrapper = control.closest(".answer-control");
    if (!wrapper) return;
    if (control.type === "radio") {
      document.querySelectorAll(`[data-answer-key="${control.dataset.answerKey}"]`).forEach(radio => {
        const row = radio.closest(".answer-control");
        if (row) row.classList.remove("is-correct", "is-incorrect");
      });
    } else {
      wrapper.classList.remove("is-correct", "is-incorrect");
    }
    if (!show || !controlValue(control).trim()) return;
    const target = control.type === "radio"
      ? (document.querySelector(`[data-answer-key="${control.dataset.answerKey}"]:checked`) || control).closest(".answer-control")
      : wrapper;
    if (target) target.classList.add(isCorrect(control) ? "is-correct" : "is-incorrect");
  }

  function registerControl(control, questionId, answerKey) {
    const key = `${questionId}:${answerKey}`;
    control.dataset.answerKey = key;
    const write = (showFeedback) => {
      state.answers[key] = controlValue(control);
      setFeedback(control, showFeedback);
      updateProgress();
      queueSave();
    };
    control.addEventListener("input", () => write(false));
    control.addEventListener("change", () => write(true));
    control.addEventListener("blur", () => setFeedback(control, true));
  }

  function fillShell() {
    document.title = `${data.lessonTitle} · Fluency Studio`;
    setText("moduleBadge", data.badge);
    setText("heroTitle", data.unitTitle || data.lessonTitle);
    setText("heroSubtitle", data.subtitle);
    setText("resultsKicker", `UNIT ${data.unit} · FINAL RESULT`);
    const image = document.getElementById("heroImage");
    if (image && data.heroImage) {
      image.src = data.heroImage;
      image.alt = data.heroImageAlt || data.unitTitle || data.lessonTitle;
    }
    const figure = document.getElementById("heroFigure");
    if (figure) figure.dataset.caption = data.heroCaption || "";
    const meta = document.getElementById("metaGrid");
    if (meta && data.meta) {
      meta.innerHTML = "";
      data.meta.forEach(item => {
        const card = el("div", "meta-card");
        card.append(el("span", "meta-icon", item.icon), el("span", "meta-value", String(item.value)), el("span", "meta-label", item.label));
        meta.append(card);
      });
    }
  }

  function buildCard(exercise) {
    const card = el("section", "exercise-card");
    card.dataset.qid = exercise.id;
    card.dataset.section = exercise.section;

    const top = el("div", "card-topline");
    const status = el("span", "question-status", "0 respondidas");
    status.id = `status-${exercise.id}`;
    top.append(el("span", "section-label", exercise.section), status);

    const headingRow = el("div", "question-heading-row");
    const heading = el("div", "question-copy");
    heading.append(
      el("h2", "question-title", `Exercise ${exercise.number}`),
      el("p", "question-prompt", exercise.prompt)
    );
    const helpButton = el("button", "help-button", "?");
    helpButton.type = "button";
    helpButton.setAttribute("aria-label", `Help for exercise ${exercise.number}`);
    const helpPanel = el("div", "help-panel");
    helpPanel.hidden = true;
    helpPanel.setAttribute("aria-live", "polite");
    helpButton.addEventListener("click", () => toggleHelp(exercise, helpPanel));
    headingRow.append(el("div", "question-number", String(exercise.number).padStart(2, "0")), heading, helpButton);
    card.append(top, headingRow, helpPanel);

    if (exercise.notice) {
      const notice = el("div", "source-notice");
      notice.innerHTML = `<span aria-hidden="true">◉</span><span></span>`;
      notice.lastChild.textContent = exercise.notice;
      card.append(notice);
    }
    if (exercise.bank) card.append(buildBank(exercise.bank));
    if (exercise.example) card.append(el("div", "example-box", exercise.example));
    if (exercise.image) card.append(buildFigure(exercise.image, exercise.imageAlt || exercise.prompt));

    if (exercise.mode === "matching") card.append(buildMatching(exercise));
    if (exercise.mode === "choice") card.append(buildChoice(exercise));
    if (exercise.mode === "cloze") card.append(buildCloze(exercise));
    if (exercise.mode === "rewrite") card.append(buildRewrite(exercise));

    if (exercise.mode !== "matching") {
      const actions = el("div", "question-actions");
      const check = el("button", "check-button", "Corrigir respostas");
      check.type = "button";
      check.addEventListener("click", () => checkQuestion(exercise.id));
      actions.append(check);
      card.append(actions);
    }
    return card;
  }

  function buildBank(text) {
    const bank = el("div", "word-bank");
    bank.append(el("span", "word-bank-label", "WORD BANK"), el("span", "word-bank-copy", text));
    return bank;
  }

  function buildFigure(src, alt) {
    const figure = el("figure", "exercise-figure");
    const image = el("img", "");
    image.src = src;
    image.alt = alt;
    figure.append(image);
    return figure;
  }

  function buildPassage(passage) {
    const section = el("section", "reading-panel");
    section.setAttribute("aria-labelledby", `passage-${passage.id}`);
    const header = el("div", "reading-header");
    header.append(el("h2", "reading-title", passage.title));
    if (passage.subtitle) header.append(el("p", "reading-subtitle", passage.subtitle));
    const grid = el("div", "article-grid");
    passage.paragraphs.forEach(paragraph => {
      const p = el("p", "");
      const letter = el("span", "paragraph-letter", paragraph.letter);
      p.append(letter, document.createTextNode(paragraph.text));
      grid.append(p);
    });
    section.append(header, grid);
    if (passage.image) section.append(buildFigure(passage.image, passage.imageAlt || passage.title));
    return section;
  }

  function buildMatching(exercise) {
    const wrap = el("div", `matching-list${exercise.compact ? " is-compact" : ""}`);
    exercise.items.forEach((item, index) => {
      const row = el("div", "matching-row answer-control");
      const label = el("label", "matching-label", item.label);
      label.htmlFor = `${exercise.id}-${index}`;
      const select = el("select", "matching-select");
      select.id = `${exercise.id}-${index}`;
      select.dataset.answers = JSON.stringify(item.answers || [item.answer]);
      const placeholder = el("option", "", "— select —");
      placeholder.value = "";
      select.append(placeholder);
      exercise.options.forEach(option => {
        const optionNode = el("option", "", option);
        optionNode.value = option;
        select.append(optionNode);
      });
      row.append(label, select, el("span", "answer-mark"));
      registerControl(select, exercise.id, index);
      wrap.append(row);
    });
    return wrap;
  }

  function buildChoice(exercise) {
    const wrap = el("div", "choice-list");
    exercise.items.forEach((item, index) => {
      const block = el("div", "choice-item");
      if (item.label) block.append(el("p", "choice-stem", item.label));
      const options = el("div", "choice-options");
      item.options.forEach(option => {
        const row = el("label", "choice-option answer-control");
        const input = el("input", "");
        input.type = "radio";
        input.name = `${exercise.id}-${index}`;
        input.value = option;
        input.dataset.answers = JSON.stringify(item.answers || [item.answer]);
        row.append(input, el("span", "choice-copy", option), el("span", "answer-mark"));
        registerControl(input, exercise.id, index);
        options.append(row);
      });
      block.append(options);
      wrap.append(block);
    });
    return wrap;
  }

  function buildCloze(exercise) {
    const wrap = el("div", "cloze-groups");
    exercise.groups.forEach((group, groupIndex) => {
      const groupNode = el("div", `cloze-group${group.image ? " with-image" : ""}`);
      const copyWrap = el("div", "cloze-group-copy");
      if (group.title) copyWrap.append(el("h3", "group-title", group.title));
      if (group.bank) copyWrap.append(buildBank(group.bank));
      const passage = el("div", "cloze-passage");
      let blankIndex = 0;
      group.segments.forEach(segment => {
        if (typeof segment === "string") {
          passage.append(document.createTextNode(segment));
          return;
        }
        const controlWrap = el("span", "inline-answer answer-control");
        const input = el("input", "inline-input");
        input.type = "text";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.setAttribute("aria-label", `Gap ${segment.blank}`);
        input.placeholder = segment.blank;
        input.dataset.answers = JSON.stringify(segment.answers);
        if (segment.strict || exercise.strict) input.dataset.strict = "true";
        const longest = Math.max(...segment.answers.map(answer => String(answer).length));
        input.style.setProperty("--answer-size", `${Math.max(8, Math.min(25, longest + 2))}ch`);
        controlWrap.append(input, el("span", "answer-mark"));
        passage.append(controlWrap);
        if (segment.cue) passage.append(el("span", "word-cue", segment.cue));
        registerControl(input, exercise.id, `${groupIndex}-${blankIndex}`);
        blankIndex += 1;
      });
      copyWrap.append(passage);
      groupNode.append(copyWrap);
      if (group.image) {
        const figure = el("figure", "group-figure");
        const image = el("img", "");
        image.src = group.image;
        image.alt = group.title || exercise.prompt;
        figure.append(image);
        groupNode.append(figure);
      }
      wrap.append(groupNode);
    });
    return wrap;
  }

  function buildRewrite(exercise) {
    const list = el("div", "rewrite-list");
    exercise.items.forEach((item, index) => {
      const row = el("div", "rewrite-row answer-control");
      const source = el("div", "rewrite-source");
      const sourceCopy = el("span", "rewrite-source-copy");
      if (item.italic && item.original.includes(item.italic)) {
        const [before, after] = item.original.split(item.italic);
        sourceCopy.append(document.createTextNode(before), el("em", "rewrite-focus", item.italic), document.createTextNode(after));
      } else {
        sourceCopy.textContent = item.original;
      }
      source.append(el("span", "rewrite-letter", item.label), sourceCopy);
      const textarea = el("textarea", "rewrite-input");
      textarea.rows = 2;
      textarea.placeholder = item.placeholder || "Write the complete sentence…";
      textarea.dataset.answers = JSON.stringify(item.answers);
      if (exercise.strict) textarea.dataset.strict = "true";
      textarea.setAttribute("aria-label", `Answer ${item.label}`);
      row.append(source, textarea, el("span", "answer-mark"));
      registerControl(textarea, exercise.id, index);
      list.append(row);
    });
    return list;
  }

  function toggleHelp(exercise, panel) {
    const current = helpStages[exercise.id] || 0;
    const next = current >= 2 ? 0 : current + 1;
    helpStages[exercise.id] = next;
    if (next === 0) {
      panel.hidden = true;
      panel.textContent = "";
      return;
    }
    panel.hidden = false;
    panel.textContent = "";
    panel.append(
      el("span", "help-stage", next === 1 ? "HINT" : "ANSWER KEY"),
      el("span", "help-copy", next === 1 ? exercise.hint : exercise.explanation)
    );
  }

  function checkQuestion(questionId) {
    const controls = scoredControls().filter(control => control.dataset.answerKey.startsWith(`${questionId}:`));
    controls.forEach(control => setFeedback(control, true));
    const missing = controls.filter(control => !controlValue(control).trim()).length;
    const incorrect = controls.filter(control => controlValue(control).trim() && !isCorrect(control)).length;
    const status = document.getElementById(`status-${questionId}`);
    if (missing) status.textContent = `${missing} por responder`;
    else if (incorrect) status.textContent = `${incorrect} para revisar`;
    else status.textContent = "Completo ✓";
  }

  function scoredControls() {
    const nodes = [...document.querySelectorAll("[data-answer-key]")];
    const seen = new Set();
    return nodes.filter(control => {
      const key = control.dataset.answerKey;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function updateProgress() {
    const controls = scoredControls();
    const answered = controls.filter(control => controlValue(control).trim()).length;
    const total = controls.length;
    const percentage = total ? Math.round((answered / total) * 100) : 0;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${answered} de ${total} respostas`;
    submitButton.disabled = answered !== total;
    const responsesMeta = document.getElementById("metaResponses");
    if (responsesMeta) responsesMeta.textContent = String(total);
    resultTotal.textContent = String(total);
    data.exercises.forEach(exercise => {
      const items = controls.filter(control => control.dataset.answerKey.startsWith(`${exercise.id}:`));
      const done = items.filter(control => controlValue(control).trim()).length;
      const status = document.getElementById(`status-${exercise.id}`);
      if (status && !status.textContent.includes("revisar") && status.textContent !== "Completo ✓") {
        status.textContent = `${done}/${items.length} respondidas`;
      }
    });
  }

  function queueSave() {
    clearTimeout(saveTimer);
    autosaveText.textContent = "Salvando…";
    saveTimer = setTimeout(() => saveProgress(), 800);
  }

  function scoreDetails() {
    const controls = scoredControls();
    const perSection = {};
    data.exercises.forEach(exercise => {
      const items = controls.filter(control => control.dataset.answerKey.startsWith(`${exercise.id}:`));
      const correct = items.filter(isCorrect).length;
      const section = exercise.section;
      if (!perSection[section]) perSection[section] = { correct: 0, total: 0 };
      perSection[section].correct += correct;
      perSection[section].total += items.length;
    });
    const total = controls.length;
    const correct = controls.filter(isCorrect).length;
    const percentage = total ? Math.round((correct / total) * 100) : 0;
    return {
      correct,
      incorrect: total - correct,
      total,
      percentage,
      grade10: Number((percentage / 10).toFixed(1)),
      perSection
    };
  }

  function buildPayload(completed = state.completed, score = state.score) {
    const now = Date.now();
    if (!state.firstAccessAt) state.firstAccessAt = now;
    if (completed && !state.completedAt) state.completedAt = now;
    const payload = {
      lessonId: data.lessonId,
      unit: data.unit,
      lessonTitle: data.lessonTitle,
      answers: { ...state.answers },
      updatedAt: now,
      accessed: true,
      firstAccessAt: state.firstAccessAt,
      completed,
      completedAt: state.completedAt || null,
      timeToCompleteMs: (state.completedAt && state.firstAccessAt)
        ? Math.max(0, state.completedAt - state.firstAccessAt)
        : null,
      attempts: state.attempts || 0,
      score
    };
    return payload;
  }

  function portalConfigured() {
    return typeof window.saveExerciseProgress === "function";
  }

  function broadcastProgress(payload) {
    try {
      const msg = { type: "fluency:exercise-progress", path: data.firestorePath, payload };
      if (window.parent && window.parent !== window) window.parent.postMessage(msg, "*");
      if (window.opener && !window.opener.closed) window.opener.postMessage(msg, "*");
    } catch (_) {}
  }

  async function saveProgress(completed = state.completed, score = state.score) {
    const payload = buildPayload(completed, score);
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {}
    broadcastProgress(payload);
    if (portalConfigured()) {
      try {
        await window.saveExerciseProgress(data.firestorePath, payload);
        autosaveText.textContent = "Progresso salvo";
        return payload;
      } catch (_) {
        autosaveText.textContent = "Não foi possível salvar no portal";
        return payload;
      }
    }
    autosaveText.textContent = "Prévia local — progresso não enviado";
    return payload;
  }

  async function restoreProgress() {
    let saved = null;
    if (typeof window.loadExerciseProgress === "function") {
      try { saved = await window.loadExerciseProgress(data.firestorePath); } catch (_) { saved = null; }
    }
    if (!saved || !saved.answers) {
      try { saved = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch (_) { saved = null; }
    }
    if (!saved) return;
    if (saved.firstAccessAt) state.firstAccessAt = saved.firstAccessAt;
    if (saved.completedAt) state.completedAt = saved.completedAt;
    if (typeof saved.attempts === "number" && saved.attempts >= 0) state.attempts = saved.attempts;
    if (!saved.answers) return;
    state.answers = saved.answers;
    state.completed = Boolean(saved.completed);
    state.score = saved.score || null;
    document.querySelectorAll("[data-answer-key]").forEach(control => {
      const value = state.answers[control.dataset.answerKey];
      if (value === undefined) return;
      if (control.type === "radio") {
        control.checked = control.value === value;
      } else {
        control.value = value;
      }
      setFeedback(control, true);
    });
  }

  function saveNote(score) {
    if (portalConfigured()) {
      return score
        ? "Resultado enviado ao portal. A nota já pode aparecer no report card."
        : "Progresso enviado ao portal.";
    }
    return "Resultado salvo neste navegador. Conecte o hook do Firebase no portal para gravar a nota.";
  }

  function showResults(score) {
    resultScore.textContent = `${score.percentage}/100`;
    resultCorrect.textContent = String(score.correct);
    resultTotal.textContent = String(score.total);
    resultGrade.textContent = `${score.percentage}`;
    resultBreakdown.textContent = "";
    Object.entries(score.perSection).forEach(([section, values]) => {
      const row = el("div", "result-section-row");
      row.append(
        el("span", "result-section-name", section),
        el("span", "result-section-value", `${values.correct}/${values.total}`)
      );
      resultBreakdown.append(row);
    });
    resultSaveNote.textContent = saveNote(score);
    resultsModal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeResults() {
    resultsModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  async function copyResult() {
    if (!state.score) return;
    const lines = [
      data.lessonTitle,
      `Nota: ${state.score.percentage}/100`,
      `Acertos: ${state.score.correct}/${state.score.total}`,
      `Tentativas: ${state.attempts || 0}`,
      `Percentual: ${state.score.percentage}%`,
      ...Object.entries(state.score.perSection).map(([section, values]) => `${section}: ${values.correct}/${values.total}`)
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      resultSaveNote.textContent = "Resumo copiado.";
    } catch (_) {
      resultSaveNote.textContent = "A cópia automática não foi permitida. O resultado permanece salvo.";
    }
  }

  function submit() {
    const controls = scoredControls();
    controls.forEach(control => setFeedback(control, true));
    const score = scoreDetails();
    state.attempts = (state.attempts || 0) + 1;
    state.completed = true;
    state.score = score;
    saveProgress(true, score);
    summary.hidden = false;
    summary.classList.toggle("has-errors", score.incorrect > 0);
    summary.textContent = `Nota ${score.percentage}/100 · ${score.correct} de ${score.total} · tentativa ${state.attempts}`;
    submitButton.textContent = "Ver resultado novamente";
    showResults(score);
  }

  function addIviMessage(role, message) {
    const bubble = el("div", `ivi-message ${role === "student" ? "from-student" : "from-ivi"}`);
    bubble.append(el("span", "ivi-message-name", role === "student" ? "YOU" : "iVi"), el("span", "ivi-message-copy", message));
    iviMessages.append(bubble);
    iviMessages.scrollTop = iviMessages.scrollHeight;
  }

  function selectedIviKnowledge() {
    const fallback = data.ivi.exercises[data.exercises[0].id];
    return data.ivi.exercises[iviExercise.value] || fallback;
  }

  function iviHintFor(question) {
    const knowledge = selectedIviKnowledge();
    const match = String(question || "").match(/(?:gap|lacuna|item|letra|#)\s*([a-z]|\d+)/i);
    if (match && knowledge.steps && knowledge.steps[match[1].toLowerCase()]) {
      return knowledge.steps[match[1].toLowerCase()];
    }
    return knowledge.hint;
  }

  function askIvi() {
    const question = iviQuestion.value.trim();
    if (!question) return;
    addIviMessage("student", question);
    addIviMessage("ivi", iviHintFor(question));
    iviQuestion.value = "";
    iviQuestion.focus();
  }

  function initIvi() {
    data.exercises.forEach(exercise => {
      const option = el("option", "", `Exercise ${exercise.number} · ${exercise.section}`);
      option.value = exercise.id;
      iviExercise.append(option);
    });
    addIviMessage("ivi", data.ivi.welcome);
    iviLauncher.addEventListener("click", () => {
      iviPanel.hidden = false;
      iviLauncher.setAttribute("aria-expanded", "true");
      iviQuestion.focus();
    });
    document.getElementById("iviClose").addEventListener("click", () => {
      iviPanel.hidden = true;
      iviLauncher.setAttribute("aria-expanded", "false");
    });
    document.getElementById("iviSend").addEventListener("click", askIvi);
    document.getElementById("iviHintButton").addEventListener("click", () => addIviMessage("ivi", selectedIviKnowledge().hint));
    iviQuestion.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        askIvi();
      }
    });
  }

  async function render() {
    fillShell();
    data.exercises.forEach(exercise => {
      shell.append(buildCard(exercise));
      if (exercise.passageAfter && data.passages) {
        const passage = data.passages.find(item => item.id === exercise.passageAfter);
        if (passage) shell.append(buildPassage(passage));
      }
    });
    initIvi();
    await restoreProgress();
    updateProgress();
    saveProgress(state.completed, state.score);
    if (state.completed && state.score) {
      summary.hidden = false;
      summary.textContent = `Nota ${state.score.grade10.toFixed(1)}/10 · ${state.score.correct} de ${state.score.total} respostas corretas.`;
      submitButton.textContent = "Ver resultado novamente";
      submitButton.disabled = false;
    }
  }

  submitButton.addEventListener("click", submit);
  document.getElementById("closeResults").addEventListener("click", closeResults);
  document.getElementById("reviewResults").addEventListener("click", closeResults);
  document.getElementById("copyResults").addEventListener("click", copyResult);
  resultsModal.addEventListener("click", event => {
    if (event.target === resultsModal) closeResults();
  });
  render();
})();
