const LEAD_DETAILS_STORAGE_KEY = "joinSlssaLeadDetails";

function getLeadModal() {
  return document.querySelector("[data-lead-modal]");
}

function getLeadForm() {
  return document.querySelector("[data-lead-form]");
}

function getFieldValue(form, name) {
  const field = form.elements[name];
  return field ? String(field.value || "").trim() : "";
}

function setFieldValue(form, name, value) {
  const field = form.elements[name];

  if (field) {
    field.value = value || "";
  }
}

function saveReusableLeadDetails(form) {
  const details = {
    name: getFieldValue(form, "name"),
    email: getFieldValue(form, "email"),
    phone: getFieldValue(form, "phone"),
    suburb: getFieldValue(form, "suburb"),
    about: getFieldValue(form, "about")
  };

  try {
    window.localStorage.setItem(
      LEAD_DETAILS_STORAGE_KEY,
      JSON.stringify(details)
    );
  } catch (error) {
    // Ignore storage errors.
  }
}

function getReusableLeadDetails() {
  try {
    const stored = window.localStorage.getItem(LEAD_DETAILS_STORAGE_KEY);

    if (!stored) {
      return {};
    }

    return JSON.parse(stored);
  } catch (error) {
    return {};
  }
}

function restoreReusableLeadDetails(form) {
  const details = getReusableLeadDetails();

  setFieldValue(form, "name", details.name);
  setFieldValue(form, "email", details.email);
  setFieldValue(form, "phone", details.phone);
  setFieldValue(form, "suburb", details.suburb);
  setFieldValue(form, "about", details.about);
}

function getSelectedFilterLabels() {
  const labels = [];

  document.querySelectorAll("[data-filter]").forEach(function (field) {
    if (!field.value) {
      return;
    }

    const label = document.querySelector("label[for='" + field.id + "']");
    const selectedOption = field.options ? field.options[field.selectedIndex] : null;

    if (!label || !selectedOption) {
      return;
    }

    labels.push({
      name: label.textContent.trim(),
      value: selectedOption.textContent.trim()
    });
  });

  return labels;
}

function updateLeadFilterSummary() {
  const summary = document.querySelector("[data-lead-filter-summary]");
  const list = document.querySelector("[data-lead-filter-list]");

  if (!summary || !list) {
    return;
  }

  const filters = getSelectedFilterLabels();

  list.innerHTML = "";

  if (filters.length === 0) {
    summary.hidden = true;
    return;
  }

  filters.forEach(function (filter) {
    const item = document.createElement("li");
    item.textContent = filter.name + ": " + filter.value;
    list.appendChild(item);
  });

  summary.hidden = false;
}

function showLeadMessage(message, type) {
  const messageElement = document.querySelector("[data-lead-message]");

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
  messageElement.dataset.messageType = type || "success";
  messageElement.hidden = false;
}

function clearLeadMessage() {
  const messageElement = document.querySelector("[data-lead-message]");

  if (!messageElement) {
    return;
  }

  messageElement.textContent = "";
  messageElement.hidden = true;
}

function openLeadForm(context) {
  const modal = getLeadModal();
  const form = getLeadForm();

  if (!modal || !form) {
    return;
  }

  const clubName = modal.querySelector("[data-lead-club-name]");
  const clubSlug = modal.querySelector("[data-lead-club-slug]");

  if (clubName) {
    clubName.textContent = context.clubTitle || "Selected surf life saving club";
  }

  if (clubSlug) {
    clubSlug.value = context.clubSlug || "";
  }

  restoreReusableLeadDetails(form);
  updateLeadFilterSummary();
  clearLeadMessage();

  modal.hidden = false;
  document.body.classList.add("lead-modal-open");

  const firstField = form.querySelector("input[name='name']");

  if (firstField) {
    window.setTimeout(function () {
      firstField.focus();
    }, 50);
  }
}

function closeLeadForm() {
  const modal = getLeadModal();

  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("lead-modal-open");
}

function buildLeadPayload(form) {
  return {
    clubSlug: getFieldValue(form, "clubSlug"),
    name: getFieldValue(form, "name"),
    email: getFieldValue(form, "email"),
    phone: getFieldValue(form, "phone"),
    suburb: getFieldValue(form, "suburb"),
    about: getFieldValue(form, "about"),
    filters: getSelectedFilterLabels(),
    consent: Boolean(form.elements.consent && form.elements.consent.checked),
    sourcePage: window.location.pathname + window.location.search,
    submittedAt: new Date().toISOString()
  };
}

function handleLeadSubmit(event) {
  event.preventDefault();

  const form = event.target;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = buildLeadPayload(form);

  saveReusableLeadDetails(form);

  console.log("Lead form payload for future Azure submission:", payload);

  showLeadMessage(
    "Form captured locally for testing. The next step will send this to Azure so the selected club receives an email.",
    "success"
  );
}

document.addEventListener("click", function (event) {
  if (event.target.closest("[data-lead-close]")) {
    closeLeadForm();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeLeadForm();
  }
});

document.addEventListener("submit", function (event) {
  if (event.target.matches("[data-lead-form]")) {
    handleLeadSubmit(event);
  }
});

window.openLeadForm = openLeadForm;