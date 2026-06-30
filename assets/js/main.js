function normaliseValue(value) {
  return String(value || "").trim().toLowerCase();
}

function splitDataList(value) {
  return String(value || "")
    .split("|")
    .map(function (item) {
      return normaliseValue(item);
    })
    .filter(Boolean);
}

function getCurrentFilters() {
  const age = document.querySelector("[data-filter='age']");
  const interest = document.querySelector("[data-filter='interest']");
  const facility = document.querySelector("[data-filter='facility']");
  const commitment = document.querySelector("[data-filter='commitment']");

  return {
    age: age ? normaliseValue(age.value) : "",
    interest: interest ? normaliseValue(interest.value) : "",
    facility: facility ? normaliseValue(facility.value) : "",
    commitment: commitment ? normaliseValue(commitment.value) : ""
  };
}

function clubMatchesFilters(card, filters) {
  const ageGroups = splitDataList(card.dataset.ageGroups);
  const interests = splitDataList(card.dataset.interests);
  const facilities = splitDataList(card.dataset.facilities);
  const commitment = normaliseValue(card.dataset.commitment);

  if (filters.age && !ageGroups.includes(filters.age)) {
    return false;
  }

  if (filters.interest && !interests.includes(filters.interest)) {
    return false;
  }

  if (filters.facility && !facilities.includes(filters.facility)) {
    return false;
  }

  if (filters.commitment && commitment !== filters.commitment) {
    return false;
  }

  return true;
}

function updateFilterUrl(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(function ([key, value]) {
    if (value) {
      params.set(key, value);
    }
  });

  const newUrl = params.toString()
    ? window.location.pathname + "?" + params.toString()
    : window.location.pathname;

  window.history.replaceState({}, "", newUrl);
}

function applyFilters() {
  const cards = Array.from(document.querySelectorAll("[data-club-card]"));
  const countElement = document.querySelector("[data-results-count]");
  const summaryElement = document.querySelector("[data-results-summary]");
  const emptyState = document.querySelector("[data-empty-state]");
  const filters = getCurrentFilters();

  let visibleCount = 0;

  cards.forEach(function (card) {
    const isVisible = clubMatchesFilters(card, filters);
    card.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (countElement) {
    countElement.textContent = String(visibleCount);
  }

  if (summaryElement) {
    summaryElement.textContent = visibleCount === 1
      ? "Showing 1 matching club."
      : "Showing " + visibleCount + " matching clubs.";
  }

  if (emptyState) {
    emptyState.hidden = visibleCount !== 0;
  }

  updateFilterUrl(filters);
}

function setFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  document.querySelectorAll("[data-filter]").forEach(function (field) {
    const key = field.getAttribute("data-filter");
    const value = params.get(key);

    if (value) {
      field.value = value;
    }
  });
}

function clearFilters() {
  document.querySelectorAll("[data-filter]").forEach(function (field) {
    field.value = "";
  });

  applyFilters();
}

document.addEventListener("change", function (event) {
  if (event.target.matches("[data-filter]")) {
    applyFilters();
  }
});

document.addEventListener("click", function (event) {
  const clearButton = event.target.closest("[data-clear-filters]");

  if (clearButton) {
    clearFilters();
    return;
  }

  const leadButton = event.target.closest("[data-lead-club]");

  if (leadButton) {
    const clubSlug = leadButton.getAttribute("data-lead-club");
    alert("The Send My Details form will be added next. Selected club: " + clubSlug);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  setFiltersFromUrl();
  applyFilters();
});