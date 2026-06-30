const CURRENT_LOCATION_STORAGE_KEY = "joinSlssaCurrentLocation";

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

function toNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistanceKm(origin, destination) {
  const earthRadiusKm = 6371;

  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);
  const lat2 = toRadians(destination.latitude);
  const lon2 = toRadians(destination.longitude);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function formatDistance(distanceKm) {
  if (distanceKm === null) {
    return "Distance unavailable";
  }

  if (distanceKm < 10) {
    return distanceKm.toFixed(1) + " km";
  }

  return Math.round(distanceKm) + " km";
}

function getStoredCurrentLocation() {
  try {
    const stored = window.sessionStorage.getItem(CURRENT_LOCATION_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);

    if (
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number"
    ) {
      return parsed;
    }

    return null;
  } catch (error) {
    return null;
  }
}

function setStoredCurrentLocation(location) {
  try {
    window.sessionStorage.setItem(
      CURRENT_LOCATION_STORAGE_KEY,
      JSON.stringify(location)
    );
  } catch (error) {
    // Ignore storage errors.
  }
}

function clearStoredCurrentLocation() {
  try {
    window.sessionStorage.removeItem(CURRENT_LOCATION_STORAGE_KEY);
  } catch (error) {
    // Ignore storage errors.
  }
}

function setLocationStatus(message, type) {
  const status = document.querySelector("[data-location-status]");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.statusType = type || "info";
}

function getSelectedValues(name) {
  const selected = Array.from(
    document.querySelectorAll(
      "input[name='" + name + "'][data-filter-check]:checked"
    )
  )
    .map(function (input) {
      return normaliseValue(input.value);
    })
    .filter(Boolean);

  return selected;
}

function getSelectedOrigin() {
  const originField = document.querySelector("[data-filter='origin']");

  if (!originField || !originField.value) {
    return null;
  }

  if (originField.value === "current") {
    const storedLocation = getStoredCurrentLocation();

    if (storedLocation) {
      return {
        label: "your current location",
        latitude: storedLocation.latitude,
        longitude: storedLocation.longitude
      };
    }

    return null;
  }

  const selectedOption = originField.options[originField.selectedIndex];

  if (!selectedOption) {
    return null;
  }

  const latitude = toNumber(selectedOption.dataset.latitude);
  const longitude = toNumber(selectedOption.dataset.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    label: selectedOption.textContent.trim(),
    latitude: latitude,
    longitude: longitude
  };
}

function getCurrentFilters() {
  const origin = document.querySelector("[data-filter='origin']");
  const radius = document.querySelector("[data-filter='radius']");

  return {
    age: getSelectedValues("age"),
    interest: getSelectedValues("interest"),
    facility: getSelectedValues("facility"),
    origin: origin ? origin.value : "",
    radius: radius ? toNumber(radius.value) : null
  };
}

function getClubCoordinates(card) {
  const latitude = toNumber(card.dataset.latitude);
  const longitude = toNumber(card.dataset.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude: latitude,
    longitude: longitude
  };
}

function updateCardDistance(card, origin) {
  const inlineLabel = card.querySelector("[data-distance-label]");
  const actionLabel = card.querySelector("[data-card-distance]");
  const fallback = card.querySelector("[data-location-fallback]");

  if (!origin) {
    if (inlineLabel) {
      inlineLabel.hidden = true;
      inlineLabel.textContent = "";
    }

    if (fallback) {
      fallback.hidden = false;
    }

    if (actionLabel) {
      actionLabel.textContent = "Distance unavailable";
    }

    card.dataset.distance = "";
    return null;
  }

  const clubCoordinates = getClubCoordinates(card);

  if (!clubCoordinates) {
    if (actionLabel) {
      actionLabel.textContent = "Distance unavailable";
    }

    card.dataset.distance = "";
    return null;
  }

  const distanceKm = calculateDistanceKm(origin, clubCoordinates);
  const formatted = formatDistance(distanceKm);

  if (inlineLabel) {
    inlineLabel.textContent = formatted + " from you";
    inlineLabel.hidden = false;
  }

  if (fallback) {
    fallback.hidden = true;
  }

  if (actionLabel) {
    actionLabel.textContent = formatted;
  }

  card.dataset.distance = String(distanceKm);

  return distanceKm;
}

function hasAnyMatch(selectedValues, availableValues) {
  if (selectedValues.length === 0) {
    return true;
  }

  return selectedValues.some(function (value) {
    return availableValues.includes(value);
  });
}

function clubMatchesFilters(card, filters, origin) {
  const ageGroups = splitDataList(card.dataset.ageGroups);
  const interests = splitDataList(card.dataset.interests);
  const facilities = splitDataList(card.dataset.facilities);
  const distanceKm = updateCardDistance(card, origin);

  if (!hasAnyMatch(filters.age, ageGroups)) {
    return false;
  }

  if (!hasAnyMatch(filters.interest, interests)) {
    return false;
  }

  if (!hasAnyMatch(filters.facility, facilities)) {
    return false;
  }

  if (origin && filters.radius !== null) {
    if (distanceKm === null || distanceKm > filters.radius) {
      return false;
    }
  }

  return true;
}

function updateFilterUrl(filters) {
  const params = new URLSearchParams();

  filters.age.forEach(function (value) {
    params.append("age", value);
  });

  filters.interest.forEach(function (value) {
    params.append("interest", value);
  });

  filters.facility.forEach(function (value) {
    params.append("facility", value);
  });

  if (filters.origin) {
    params.set("origin", filters.origin);
  }

  if (filters.radius !== null) {
    params.set("radius", String(filters.radius));
  }

  const newUrl = params.toString()
    ? window.location.pathname + "?" + params.toString()
    : window.location.pathname;

  window.history.replaceState({}, "", newUrl);
}

function updateLocationStatus(origin, filters) {
  if (!filters.origin) {
    setLocationStatus(
      "Select a location or use your current location to filter by distance.",
      "info"
    );
    return;
  }

  if (filters.origin === "current" && !origin) {
    setLocationStatus(
      "Current location has not been set yet. Use the button above to allow location access.",
      "warning"
    );
    return;
  }

  if (origin && filters.radius !== null) {
    setLocationStatus(
      "Showing clubs within " + filters.radius + " km of " + origin.label + ".",
      "success"
    );
    return;
  }

  if (origin) {
    setLocationStatus(
      "Distances are being shown from " +
        origin.label +
        ". Select a maximum distance to filter results.",
      "success"
    );
  }
}

function sortCards(cards, sortMode) {
  const list = document.querySelector("[data-club-list]");

  if (!list) {
    return;
  }

  const sorted = cards.slice().sort(function (a, b) {
    if (sortMode === "distance") {
      const aDistance = toNumber(a.dataset.distance);
      const bDistance = toNumber(b.dataset.distance);

      if (aDistance === null && bDistance === null) {
        return 0;
      }

      if (aDistance === null) {
        return 1;
      }

      if (bDistance === null) {
        return -1;
      }

      return aDistance - bDistance;
    }

    if (sortMode === "members-desc") {
      return (toNumber(b.dataset.members) || 0) - (toNumber(a.dataset.members) || 0);
    }

    if (sortMode === "name-asc") {
      return String(a.dataset.title || "").localeCompare(String(b.dataset.title || ""));
    }

    return 0;
  });

  sorted.forEach(function (card) {
    list.appendChild(card);
  });
}

function applyFilters() {
  const cards = Array.from(document.querySelectorAll("[data-club-card]"));
  const countElement = document.querySelector("[data-results-count]");
  const summaryElement = document.querySelector("[data-results-summary]");
  const emptyState = document.querySelector("[data-empty-state]");
  const sortField = document.querySelector("[data-sort-clubs]");
  const filters = getCurrentFilters();
  const origin = getSelectedOrigin();

  let visibleCount = 0;

  cards.forEach(function (card) {
    const isVisible = clubMatchesFilters(card, filters, origin);
    card.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (sortField) {
    sortCards(cards, sortField.value);
  }

  if (countElement) {
    countElement.textContent = String(visibleCount);
  }

  if (summaryElement) {
    summaryElement.textContent =
      visibleCount === 1
        ? "Showing 1 matching club."
        : "Showing " + visibleCount + " matching clubs.";
  }

  if (emptyState) {
    emptyState.hidden = visibleCount !== 0;
  }

  updateLocationStatus(origin, filters);
  updateFilterUrl(filters);
}

function setCheckboxesFromUrl(name, values) {
  const inputs = Array.from(
    document.querySelectorAll("input[name='" + name + "'][data-filter-check]")
  );

  inputs.forEach(function (input) {
    if (input.value === "") {
      input.checked = values.length === 0;
      return;
    }

    input.checked = values.includes(input.value);
  });
}

function setFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  setCheckboxesFromUrl("age", params.getAll("age"));
  setCheckboxesFromUrl("interest", params.getAll("interest"));
  setCheckboxesFromUrl("facility", params.getAll("facility"));

  document.querySelectorAll("select[data-filter]").forEach(function (field) {
    const key = field.getAttribute("data-filter");
    const value = params.get(key);

    if (value) {
      field.value = value;
    }
  });
}

function clearFilters() {
  document.querySelectorAll("select[data-filter]").forEach(function (field) {
    field.value = "";
  });

  document.querySelectorAll("input[data-filter-check]").forEach(function (input) {
    input.checked = input.value === "";
  });

  clearStoredCurrentLocation();
  applyFilters();
}

function handleCheckboxChange(input) {
  if (input.name !== "age") {
    return;
  }

  const allAgesInput = document.querySelector("input[name='age'][value='']");

  if (!allAgesInput) {
    return;
  }

  if (input.value === "" && input.checked) {
    document.querySelectorAll("input[name='age'][data-filter-check]").forEach(function (ageInput) {
      if (ageInput !== allAgesInput) {
        ageInput.checked = false;
      }
    });

    return;
  }

  if (input.value !== "" && input.checked) {
    allAgesInput.checked = false;
  }

  const selectedSpecificAges = document.querySelectorAll(
    "input[name='age'][data-filter-check]:checked:not([value=''])"
  );

  if (selectedSpecificAges.length === 0) {
    allAgesInput.checked = true;
  }
}

function useCurrentLocation() {
  const originField = document.querySelector("[data-filter='origin']");

  if (!navigator.geolocation) {
    setLocationStatus(
      "This browser does not support location access. Select a location from the list instead.",
      "warning"
    );
    return;
  }

  setLocationStatus("Requesting your current location...", "info");

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      setStoredCurrentLocation(location);

      if (originField) {
        originField.value = "current";
      }

      setLocationStatus(
        "Current location set. Select a maximum distance to filter results.",
        "success"
      );

      applyFilters();
    },
    function () {
      setLocationStatus(
        "Location access was not allowed. Select a location from the list instead.",
        "warning"
      );
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

function getLeadClubTitle(button) {
  const card = button.closest("[data-club-card]");

  if (card) {
    const heading = card.querySelector("h2");

    if (heading) {
      return heading.textContent.trim();
    }
  }

  const pageHeading = document.querySelector("h1");

  if (pageHeading) {
    return pageHeading.textContent.trim();
  }

  return "Selected surf life saving club";
}

document.addEventListener("change", function (event) {
  if (event.target.matches("select[data-filter]")) {
    if (
      event.target.getAttribute("data-filter") === "origin" &&
      event.target.value !== "current"
    ) {
      clearStoredCurrentLocation();
    }

    applyFilters();
    return;
  }

  if (event.target.matches("input[data-filter-check]")) {
    handleCheckboxChange(event.target);
    applyFilters();
    return;
  }

  if (event.target.matches("[data-sort-clubs]")) {
    applyFilters();
  }
});

document.addEventListener("click", function (event) {
  const clearButton = event.target.closest("[data-clear-filters]");

  if (clearButton) {
    clearFilters();
    return;
  }

  const currentLocationButton = event.target.closest("[data-use-current-location]");

  if (currentLocationButton) {
    useCurrentLocation();
    return;
  }

  const leadButton = event.target.closest("[data-lead-club]");

  if (leadButton) {
    const clubSlug = leadButton.getAttribute("data-lead-club");
    const clubTitle = getLeadClubTitle(leadButton);

    if (typeof window.openLeadForm === "function") {
      window.openLeadForm({
        clubSlug: clubSlug,
        clubTitle: clubTitle
      });
    }
  }
});

document.addEventListener("DOMContentLoaded", function () {
  setFiltersFromUrl();
  applyFilters();
});