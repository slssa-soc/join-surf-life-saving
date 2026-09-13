const LEAD_DETAILS_STORAGE_KEY = "joinSlssaLeadDetails";

const LEAD_API_URL =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://localhost:7071/api/lead"
    : "https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net/api/lead";

function getLeadModal() {
  return document.querySelector("[data-lead-modal]");
}

function getLeadForm() {
  return document.querySelector("[data-lead-form]");
}

function getFieldValue(form, name) {
  const field = form.elements[name];

  return field
    ? String(field.value || "").trim()
    : "";
}

function setFieldValue(form, name, value) {
  const field = form.elements[name];

  if (field) {
    field.value = value || "";
  }
}

function getLabelTextForField(field) {
  const wrappingLabel = field.closest("label");

  if (wrappingLabel) {
    const span = wrappingLabel.querySelector("span");

    if (span) {
      return span.textContent.trim();
    }

    return wrappingLabel.textContent.trim();
  }

  if (field.id) {
    const explicitLabel = document.querySelector(
      "label[for='" + field.id + "']"
    );

    if (explicitLabel) {
      return explicitLabel.textContent.trim();
    }
  }

  return "";
}

function getLeadInterestValues(form) {
  return Array.from(
    form.querySelectorAll("[data-lead-interest]:checked")
  )
    .map(function (field) {
      return String(field.value || "").trim();
    })
    .filter(Boolean);
}

function getLeadInterestLabels(form) {
  return Array.from(
    form.querySelectorAll("[data-lead-interest]:checked")
  )
    .map(function (field) {
      return {
        name: "Interest",
        value:
          String(field.dataset.leadInterestLabel || "").trim() ||
          getLabelTextForField(field) ||
          String(field.value || "").trim()
      };
    })
    .filter(function (item) {
      return item.value;
    });
}

function setLeadInterestValues(form, values) {
  const selectedValues = new Set(
    Array.isArray(values)
      ? values.map(function (value) {
          return String(value || "").trim();
        })
      : []
  );

  form
    .querySelectorAll("[data-lead-interest]")
    .forEach(function (field) {
      field.checked = selectedValues.has(
        String(field.value || "").trim()
      );
    });
}

function getSelectedPageInterests() {
  return Array.from(
    document.querySelectorAll(
      "input[name='interest'][data-filter-check]:checked"
    )
  )
    .map(function (field) {
      return String(field.value || "").trim();
    })
    .filter(Boolean);
}

function saveReusableLeadDetails(form) {
  const details = {
    name: getFieldValue(form, "name"),
    email: getFieldValue(form, "email"),
    phone: getFieldValue(form, "phone"),
    suburb: getFieldValue(form, "suburb"),
    about: getFieldValue(form, "about"),
    interests: getLeadInterestValues(form)
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
    const stored = window.localStorage.getItem(
      LEAD_DETAILS_STORAGE_KEY
    );

    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
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

  const pageInterests = getSelectedPageInterests();

  /*
   * Current browse/wizard selections take priority.
   * If none are selected, fall back to the interests saved
   * from the user's previous enquiry.
   */
  if (pageInterests.length > 0) {
    setLeadInterestValues(
      form,
      pageInterests
    );

    return;
  }

  if (Array.isArray(details.interests)) {
    setLeadInterestValues(
      form,
      details.interests
    );

    return;
  }

  setLeadInterestValues(
    form,
    []
  );
}

function getSelectedFilterLabels(form) {
  const labels = [];

  const originField = document.querySelector(
    "input[data-filter='origin']"
  );

  if (
    originField &&
    originField.value.trim()
  ) {
    labels.push({
      name: "Location",
      value: originField.value.trim()
    });
  }

  document
    .querySelectorAll("select[data-filter]")
    .forEach(function (field) {
      if (!field.value) {
        return;
      }

      const selectedOption =
        field.options
          ? field.options[field.selectedIndex]
          : null;

      if (!selectedOption) {
        return;
      }

      let groupName = "Filter";

      if (
        field.id === "filter-radius" ||
        field.dataset.filter === "radius"
      ) {
        groupName = "Distance";
      }

      labels.push({
        name: groupName,
        value: selectedOption.textContent.trim()
      });
    });

  document
    .querySelectorAll(
      "input[data-filter-check]:checked"
    )
    .forEach(function (field) {
      /*
       * Interests are controlled by the enquiry form.
       * Do not also send the browse-page interest checkbox,
       * otherwise the same interest could be duplicated.
       */
      if (
        !field.value ||
        field.name === "interest"
      ) {
        return;
      }

      let groupName = "Filter";

      if (field.name === "age") {
        groupName = "Age group";
      }

      if (field.name === "facility") {
        groupName = "Facility";
      }

      labels.push({
        name: groupName,
        value: getLabelTextForField(field)
      });
    });

  labels.push.apply(
    labels,
    getLeadInterestLabels(form)
  );

  return labels;
}

function showLeadMessage(message, type) {
  const messageElement = document.querySelector(
    "[data-lead-message]"
  );

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;

  messageElement.dataset.messageType =
    type || "success";

  messageElement.hidden = false;
}

function clearLeadMessage() {
  const messageElement = document.querySelector(
    "[data-lead-message]"
  );

  if (!messageElement) {
    return;
  }

  messageElement.textContent = "";
  messageElement.hidden = true;
}

function setSubmitState(form, isSubmitting) {
  const submitButton = form.querySelector(
    "button[type='submit']"
  );

  if (!submitButton) {
    return;
  }

  submitButton.disabled = isSubmitting;

  submitButton.textContent =
    isSubmitting
      ? "Sending..."
      : "Send my details";
}

function openLeadForm(context) {
  const modal = getLeadModal();
  const form = getLeadForm();

  if (!modal || !form) {
    return;
  }

  const clubName = modal.querySelector(
    "[data-lead-club-name]"
  );

  const clubSlug = modal.querySelector(
    "[data-lead-club-slug]"
  );

  if (clubName) {
    clubName.textContent =
      context.clubTitle ||
      "Selected surf life saving club";
  }

  if (clubSlug) {
    clubSlug.value =
      context.clubSlug || "";
  }

  restoreReusableLeadDetails(form);
  clearLeadMessage();

  modal.hidden = false;

  document.body.classList.add(
    "lead-modal-open"
  );

  const firstField = form.querySelector(
    "input[name='name']"
  );

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

  document.body.classList.remove(
    "lead-modal-open"
  );
}

function buildLeadPayload(form) {
  return {
    clubSlug: getFieldValue(
      form,
      "clubSlug"
    ),

    name: getFieldValue(
      form,
      "name"
    ),

    email: getFieldValue(
      form,
      "email"
    ),

    phone: getFieldValue(
      form,
      "phone"
    ),

    suburb: getFieldValue(
      form,
      "suburb"
    ),

    about: getFieldValue(
      form,
      "about"
    ),

    filters: getSelectedFilterLabels(
      form
    ),

    consent: Boolean(
      form.elements.consent &&
      form.elements.consent.checked
    ),

    sourcePage:
      window.location.pathname +
      window.location.search,

    submittedAt:
      new Date().toISOString()
  };
}

async function submitLeadPayload(payload) {
  const response = await fetch(
    LEAD_API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    }
  );

  const result =
    await response
      .json()
      .catch(function () {
        return {};
      });

  if (
    !response.ok ||
    !result.ok
  ) {
    const error = new Error(
      result.message ||
      "The enquiry could not be submitted."
    );

    error.details =
      result.errors || [];

    throw error;
  }

  return result;
}

async function handleLeadSubmit(event) {
  event.preventDefault();

  const form = event.target;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload =
    buildLeadPayload(form);

  saveReusableLeadDetails(form);

  clearLeadMessage();

  setSubmitState(
    form,
    true
  );

  try {
    const result =
      await submitLeadPayload(
        payload
      );

    window.joinTrackLead?.();

    showLeadMessage(
      "Thanks — your details have been sent to " +
        result.clubName +
        ". You can send your details to another club without retyping them.",
      "success"
    );
  } catch (error) {
    const detailText =
      error.details &&
      error.details.length
        ? " " +
          error.details.join(" ")
        : "";

    showLeadMessage(
      error.message +
        detailText,
      "error"
    );
  } finally {
    setSubmitState(
      form,
      false
    );
  }
}

document.addEventListener(
  "click",
  function (event) {
    if (
      event.target.closest(
        "[data-lead-close]"
      )
    ) {
      closeLeadForm();
    }
  }
);

document.addEventListener(
  "keydown",
  function (event) {
    if (
      event.key === "Escape"
    ) {
      closeLeadForm();
    }
  }
);

document.addEventListener(
  "submit",
  function (event) {
    if (
      event.target.matches(
        "[data-lead-form]"
      )
    ) {
      handleLeadSubmit(event);
    }
  }
);

window.openLeadForm =
  openLeadForm;