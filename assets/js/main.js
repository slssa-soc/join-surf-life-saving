const CURRENT_LOCATION_STORAGE_KEY = "joinSlssaCurrentLocation";

const helperState = {
  age: null,
  interest: null,
  location: null
};

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
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
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

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSaLocations() {
  if (Array.isArray(window.SA_LOCATIONS)) {
    return window.SA_LOCATIONS;
  }

  const dataElement =
    document.getElementById("sa-locations-data");

  if (!dataElement) {
    return [];
  }

  try {
    const locations =
      JSON.parse(dataElement.textContent);

    return Array.isArray(locations)
      ? locations
      : [];
  } catch (error) {
    return [];
  }
}

function populateNativeLocationDatalist() {
  const datalist =
    document.getElementById("sa-location-options");

  if (!datalist) {
    return;
  }

  datalist.innerHTML = "";

  getSaLocations().forEach(function (location) {
    if (!location || !location.label) {
      return;
    }

    const option =
      document.createElement("option");

    option.value = location.label;
    datalist.appendChild(option);
  });
}

function updateLocationAutocompleteState(field) {
  const listId =
    field.getAttribute("data-location-list-id");

  const value = field.value.trim();

  if (!listId) {
    return;
  }

  if (
    value.length >= 4 &&
    normaliseValue(value) !== "current location"
  ) {
    field.setAttribute("list", listId);
  } else {
    field.removeAttribute("list");
  }
}

function getStoredCurrentLocation() {
  try {
    const stored =
      window.sessionStorage.getItem(
        CURRENT_LOCATION_STORAGE_KEY
      );

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
    window.sessionStorage.removeItem(
      CURRENT_LOCATION_STORAGE_KEY
    );
  } catch (error) {
    // Ignore storage errors.
  }
}

function setLocationStatus(message, type) {
  const status =
    document.querySelector(
      "[data-location-status]"
    );

  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.statusType =
    type || "info";
}

function getSelectedValues(name) {
  return Array.from(
    document.querySelectorAll(
      "input[name='" +
        name +
        "'][data-filter-check]:checked"
    )
  )
    .map(function (input) {
      return normaliseValue(input.value);
    })
    .filter(Boolean);
}

function findLocationByInput(value) {
  const query = normaliseValue(value);

  if (!query) {
    return null;
  }

  if (query === "current location") {
    const storedLocation =
      getStoredCurrentLocation();

    if (storedLocation) {
      return {
        label: "your current location",
        latitude: storedLocation.latitude,
        longitude: storedLocation.longitude
      };
    }

    return null;
  }

  const locations = getSaLocations();

  const exactLabelMatch =
    locations.find(function (location) {
      return (
        normaliseValue(location.label) === query
      );
    });

  if (exactLabelMatch) {
    return {
      label: exactLabelMatch.label,
      latitude: Number(
        exactLabelMatch.latitude
      ),
      longitude: Number(
        exactLabelMatch.longitude
      )
    };
  }

  const exactSuburbMatch =
    locations.find(function (location) {
      return (
        normaliseValue(location.suburb) ===
        query
      );
    });

  if (exactSuburbMatch) {
    return {
      label: exactSuburbMatch.label,
      latitude: Number(
        exactSuburbMatch.latitude
      ),
      longitude: Number(
        exactSuburbMatch.longitude
      )
    };
  }

  return null;
}

function getSelectedOrigin() {
  const originField =
    document.querySelector(
      "[data-filter='origin']"
    );

  if (!originField || !originField.value) {
    return null;
  }

  return findLocationByInput(
    originField.value
  );
}

function getCurrentFilters() {
  const origin =
    document.querySelector(
      "[data-filter='origin']"
    );

  const radius =
    document.querySelector(
      "[data-filter='radius']"
    );

  return {
    age: getSelectedValues("age"),
    interest:
      getSelectedValues("interest"),
    facility:
      getSelectedValues("facility"),
    origin: origin
      ? origin.value.trim()
      : "",
    radius: radius
      ? toNumber(radius.value)
      : null
  };
}

function getClubCoordinates(card) {
  const latitude =
    toNumber(card.dataset.latitude);

  const longitude =
    toNumber(card.dataset.longitude);

  if (
    latitude === null ||
    longitude === null
  ) {
    return null;
  }

  return {
    latitude: latitude,
    longitude: longitude
  };
}

function updateCardDistance(card, origin) {
  const inlineLabel =
    card.querySelector(
      "[data-distance-label]"
    );

  const actionLabel =
    card.querySelector(
      "[data-card-distance]"
    );

  const fallback =
    card.querySelector(
      "[data-location-fallback]"
    );

  if (!origin) {
    if (inlineLabel) {
      inlineLabel.hidden = true;
      inlineLabel.textContent = "";
    }

    if (fallback) {
      fallback.hidden = false;
    }

    if (actionLabel) {
      actionLabel.textContent =
        "Distance unavailable";
    }

    card.dataset.distance = "";
    return null;
  }

  const clubCoordinates =
    getClubCoordinates(card);

  if (!clubCoordinates) {
    if (actionLabel) {
      actionLabel.textContent =
        "Distance unavailable";
    }

    card.dataset.distance = "";
    return null;
  }

  const distanceKm =
    calculateDistanceKm(
      origin,
      clubCoordinates
    );

  const formatted =
    formatDistance(distanceKm);

  if (inlineLabel) {
    inlineLabel.textContent =
      formatted +
      " from " +
      origin.label;

    inlineLabel.hidden = false;
  }

  if (fallback) {
    fallback.hidden = true;
  }

  if (actionLabel) {
    actionLabel.textContent = formatted;
  }

  card.dataset.distance =
    String(distanceKm);

  return distanceKm;
}

function hasAnyMatch(
  selectedValues,
  availableValues
) {
  if (selectedValues.length === 0) {
    return true;
  }

  return selectedValues.some(
    function (value) {
      return availableValues.includes(value);
    }
  );
}

function clubMatchesFilters(
  card,
  filters,
  origin
) {
  const ageGroups =
    splitDataList(card.dataset.ageGroups);

  const interests =
    splitDataList(card.dataset.interests);

  const facilities =
    splitDataList(card.dataset.facilities);

  const distanceKm =
    updateCardDistance(card, origin);

  if (
    !hasAnyMatch(
      filters.age,
      ageGroups
    )
  ) {
    return false;
  }

  if (
    !hasAnyMatch(
      filters.interest,
      interests
    )
  ) {
    return false;
  }

  if (
    !hasAnyMatch(
      filters.facility,
      facilities
    )
  ) {
    return false;
  }

  if (
    origin &&
    filters.radius !== null
  ) {
    if (
      distanceKm === null ||
      distanceKm > filters.radius
    ) {
      return false;
    }
  }

  return true;
}

function updateFilterUrl(filters) {
  const params =
    new URLSearchParams();

  filters.age.forEach(
    function (value) {
      params.append("age", value);
    }
  );

  filters.interest.forEach(
    function (value) {
      params.append("interest", value);
    }
  );

  filters.facility.forEach(
    function (value) {
      params.append("facility", value);
    }
  );

  if (filters.origin) {
    params.set(
      "origin",
      filters.origin
    );
  }

  if (filters.radius !== null) {
    params.set(
      "radius",
      String(filters.radius)
    );
  }

  const newUrl =
    params.toString()
      ? window.location.pathname +
        "?" +
        params.toString()
      : window.location.pathname;

  window.history.replaceState(
    {},
    "",
    newUrl
  );
}

function updateLocationStatus(
  origin,
  filters
) {
  if (!filters.origin) {
    setLocationStatus(
      "Type a suburb or town, or use your current location.",
      "info"
    );
    return;
  }

  if (filters.origin && !origin) {
    if (filters.origin.length < 4) {
      setLocationStatus(
        "Type at least 4 characters to search.",
        "info"
      );
      return;
    }

    setLocationStatus(
      "Select a location from the suggestions.",
      "warning"
    );
    return;
  }

  if (
    origin &&
    filters.radius !== null
  ) {
    setLocationStatus(
      "Showing clubs within " +
        filters.radius +
        " km of " +
        origin.label +
        ".",
      "success"
    );
    return;
  }

  if (origin) {
    setLocationStatus(
      "Distances are shown from " +
        origin.label +
        ".",
      "success"
    );
  }
}

function sortCards(cards, sortMode) {
  const list =
    document.querySelector(
      "[data-club-list]"
    );

  if (!list) {
    return;
  }

  const sorted =
    cards.slice().sort(
      function (a, b) {
        if (sortMode === "distance") {
          const aDistance =
            toNumber(
              a.dataset.distance
            );

          const bDistance =
            toNumber(
              b.dataset.distance
            );

          if (
            aDistance === null &&
            bDistance === null
          ) {
            return String(
              a.dataset.title || ""
            ).localeCompare(
              String(
                b.dataset.title || ""
              )
            );
          }

          if (aDistance === null) {
            return 1;
          }

          if (bDistance === null) {
            return -1;
          }

          return (
            aDistance -
            bDistance
          );
        }

        return String(
          a.dataset.title || ""
        ).localeCompare(
          String(
            b.dataset.title || ""
          )
        );
      }
    );

  sorted.forEach(function (card) {
    list.appendChild(card);
  });
}

function applyFilters() {
  const cards =
    Array.from(
      document.querySelectorAll(
        "[data-club-card]"
      )
    );

  const countElement =
    document.querySelector(
      "[data-results-count]"
    );

  const summaryElement =
    document.querySelector(
      "[data-results-summary]"
    );

  const emptyState =
    document.querySelector(
      "[data-empty-state]"
    );

  const sortField =
    document.querySelector(
      "[data-sort-clubs]"
    );

  const filters =
    getCurrentFilters();

  const origin =
    getSelectedOrigin();

  let visibleCount = 0;

  cards.forEach(function (card) {
    const isVisible =
      clubMatchesFilters(
        card,
        filters,
        origin
      );

    card.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (sortField) {
    sortCards(
      cards,
      sortField.value
    );
  }

  if (countElement) {
    countElement.textContent =
      String(visibleCount);
  }

  if (summaryElement) {
    if (
      filters.age.length === 0 &&
      filters.interest.length === 0 &&
      filters.facility.length === 0 &&
      !filters.origin &&
      filters.radius === null
    ) {
      summaryElement.textContent =
        "Showing all Surf Life Saving SA clubs.";
    } else {
      summaryElement.textContent =
        visibleCount === 1
          ? "Showing 1 matching club."
          : "Showing " +
            visibleCount +
            " matching clubs.";
    }
  }

  if (emptyState) {
    emptyState.hidden =
      visibleCount !== 0;
  }

  updateLocationStatus(
    origin,
    filters
  );

  updateFilterUrl(filters);
}

function setCheckboxesFromUrl(
  name,
  values
) {
  const inputs =
    Array.from(
      document.querySelectorAll(
        "input[name='" +
          name +
          "'][data-filter-check]"
      )
    );

  inputs.forEach(function (input) {
    if (input.value === "") {
      input.checked =
        values.length === 0;
      return;
    }

    input.checked =
      values.includes(input.value);
  });
}

function setFiltersFromUrl() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const originField =
    document.querySelector(
      "[data-filter='origin']"
    );

  setCheckboxesFromUrl(
    "age",
    params.getAll("age")
  );

  setCheckboxesFromUrl(
    "interest",
    params.getAll("interest")
  );

  setCheckboxesFromUrl(
    "facility",
    params.getAll("facility")
  );

  if (
    originField &&
    params.get("origin")
  ) {
    originField.value =
      params.get("origin");

    updateLocationAutocompleteState(
      originField
    );
  }

  document
    .querySelectorAll(
      "select[data-filter]"
    )
    .forEach(function (field) {
      const key =
        field.getAttribute(
          "data-filter"
        );

      const value =
        params.get(key);

      if (value) {
        field.value = value;
      }
    });
}

function clearFilters() {
  const originField =
    document.querySelector(
      "[data-filter='origin']"
    );

  if (originField) {
    originField.value = "";
    updateLocationAutocompleteState(
      originField
    );
  }

  document
    .querySelectorAll(
      "select[data-filter]"
    )
    .forEach(function (field) {
      field.value = "";
    });

  document
    .querySelectorAll(
      "input[data-filter-check]"
    )
    .forEach(function (input) {
      input.checked =
        input.value === "";
    });

  clearStoredCurrentLocation();
  applyFilters();
}

function handleCheckboxChange(input) {
  if (input.name !== "age") {
    return;
  }

  const allAgesInput =
    document.querySelector(
      "input[name='age'][value='']"
    );

  if (!allAgesInput) {
    return;
  }

  if (
    input.value === "" &&
    input.checked
  ) {
    document
      .querySelectorAll(
        "input[name='age'][data-filter-check]"
      )
      .forEach(
        function (ageInput) {
          if (
            ageInput !==
            allAgesInput
          ) {
            ageInput.checked =
              false;
          }
        }
      );

    return;
  }

  if (
    input.value !== "" &&
    input.checked
  ) {
    allAgesInput.checked =
      false;
  }

  const selectedSpecificAges =
    document.querySelectorAll(
      "input[name='age'][data-filter-check]:checked:not([value=''])"
    );

  if (
    selectedSpecificAges.length ===
    0
  ) {
    allAgesInput.checked = true;
  }
}

function useCurrentLocation(callback) {
  const originField =
    document.querySelector(
      "[data-filter='origin']"
    );

  if (!navigator.geolocation) {
    setLocationStatus(
      "This browser does not support location access. Type a suburb or town instead.",
      "warning"
    );

    if (
      typeof callback ===
      "function"
    ) {
      callback(false);
    }

    return;
  }

  setLocationStatus(
    "Requesting your current location...",
    "info"
  );

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const location = {
        latitude:
          position.coords.latitude,
        longitude:
          position.coords.longitude
      };

      setStoredCurrentLocation(
        location
      );

      if (originField) {
        originField.value =
          "Current location";

        updateLocationAutocompleteState(
          originField
        );
      }

      applyFilters();

      if (
        typeof callback ===
        "function"
      ) {
        callback(true);
      }
    },
    function () {
      setLocationStatus(
        "Location access was not allowed. Type a suburb or town instead.",
        "warning"
      );

      if (
        typeof callback ===
        "function"
      ) {
        callback(false);
      }
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

function getLeadClubTitle(button) {
  const helperTitle =
    button.getAttribute(
      "data-helper-club-title"
    );

  if (helperTitle) {
    return helperTitle;
  }

  const card =
    button.closest(
      "[data-club-card]"
    );

  if (card) {
    const heading =
      card.querySelector("h2");

    if (heading) {
      return heading.textContent.trim();
    }
  }

  const pageHeading =
    document.querySelector("h1");

  if (pageHeading) {
    return pageHeading.textContent.trim();
  }

  return "Selected Surf Life Saving SA club";
}

function setCheckedValues(
  name,
  values
) {
  const normalisedValues =
    values.map(function (value) {
      return normaliseValue(value);
    });

  document
    .querySelectorAll(
      "input[name='" +
        name +
        "'][data-filter-check]"
    )
    .forEach(function (input) {
      if (input.value === "") {
        input.checked =
          normalisedValues.length ===
          0;
        return;
      }

      input.checked =
        normalisedValues.includes(
          normaliseValue(
            input.value
          )
        );
    });
}

function setInterestValues(values) {
  const normalisedValues =
    values.map(function (value) {
      return normaliseValue(value);
    });

  document
    .querySelectorAll(
      "input[name='interest'][data-filter-check]"
    )
    .forEach(function (input) {
      input.checked =
        normalisedValues.includes(
          normaliseValue(
            input.value
          )
        );
    });
}

function getHelperAgeFilters() {
  if (
    helperState.age === "child"
  ) {
    return ["nippers"];
  }

  if (
    helperState.age === "youth"
  ) {
    return ["youth"];
  }

  if (
    helperState.age === "adult"
  ) {
    return ["adults"];
  }

  if (
    helperState.age === "family"
  ) {
    return ["families"];
  }

  return [];
}

function getHelperInterestFilters() {
  if (
    helperState.interest ===
    "nippers"
  ) {
    return ["nippers"];
  }

  if (
    helperState.interest ===
    "patrol"
  ) {
    return [
      "lifesaving-patrols"
    ];
  }

  if (
    helperState.interest ===
    "sport"
  ) {
    return ["surf-sports"];
  }

  if (
    helperState.interest ===
    "training"
  ) {
    return ["training"];
  }

  if (
    helperState.interest ===
    "volunteer"
  ) {
    return [
      "volunteering",
      "community"
    ];
  }

  if (
    helperState.interest ===
    "inclusive"
  ) {
    return [
      "inclusive-programs"
    ];
  }

  return [];
}

function applyHelperFilters() {
  setCheckedValues(
    "age",
    getHelperAgeFilters()
  );

  setInterestValues(
    getHelperInterestFilters()
  );

  const radiusField =
    document.querySelector(
      "[data-filter='radius']"
    );

  const origin =
    getSelectedOrigin();

  if (
    origin &&
    radiusField &&
    !radiusField.value
  ) {
    radiusField.value = "25";
  }

  const sortField =
    document.querySelector(
      "[data-sort-clubs]"
    );

  if (origin && sortField) {
    sortField.value =
      "distance";
  }

  applyFilters();
}

function resetHelperState() {
  helperState.age = null;
  helperState.interest = null;
  helperState.location = null;
}

function getHelperContentElement() {
  return document.querySelector(
    "[data-helper-content]"
  );
}

function getHelperPanelElement() {
  return document.querySelector(
    "[data-helper-panel]"
  );
}

function getHelperStepLabel(
  stepNumber
) {
  return `
    <div
      class="club-helper__progress"
      aria-label="Step ${stepNumber} of 3"
    >
      <span class="${stepNumber >= 1 ? "is-active" : ""}"></span>
      <span class="${stepNumber >= 2 ? "is-active" : ""}"></span>
      <span class="${stepNumber >= 3 ? "is-active" : ""}"></span>
    </div>
  `;
}

function renderHelperStart() {
  resetHelperState();
  renderHelperAgeStep();
}

function renderHelperAgeStep() {
  const content =
    getHelperContentElement();

  if (!content) {
    return;
  }

  content.innerHTML = `
    ${getHelperStepLabel(1)}

    <h3 class="club-helper__question">
      Who is joining?
    </h3>

    <div class="club-helper__options club-helper__options--cards">
      <button
        type="button"
        data-helper-answer="age:child"
      >
        <strong>My child</strong>
        <span>Ages 5–13</span>
      </button>

      <button
        type="button"
        data-helper-answer="age:youth"
      >
        <strong>A teenager</strong>
        <span>Ages 13–18</span>
      </button>

      <button
        type="button"
        data-helper-answer="age:adult"
      >
        <strong>Me as an adult</strong>
        <span>18+</span>
      </button>

      <button
        type="button"
        data-helper-answer="age:family"
      >
        <strong>Our family</strong>
        <span>Adults and children</span>
      </button>

      <button
        type="button"
        data-helper-answer="age:any"
      >
        <strong>I'm not sure</strong>
        <span>Keep my options open</span>
      </button>
    </div>
  `;
}

function renderHelperInterestStep() {
  const content =
    getHelperContentElement();

  if (!content) {
    return;
  }

  content.innerHTML = `
    ${getHelperStepLabel(2)}

    <h3 class="club-helper__question">
      What interests you most?
    </h3>

    <div class="club-helper__options club-helper__options--cards">
      <button
        type="button"
        data-helper-answer="interest:nippers"
      >
        <strong>Nippers</strong>
        <span>Beach skills for children</span>
      </button>

      <button
        type="button"
        data-helper-answer="interest:patrol"
      >
        <strong>Lifesaving and patrols</strong>
        <span>Rescue and beach safety</span>
      </button>

      <button
        type="button"
        data-helper-answer="interest:sport"
      >
        <strong>Surf sports</strong>
        <span>Training and competition</span>
      </button>

      <button
        type="button"
        data-helper-answer="interest:training"
      >
        <strong>Training and new skills</strong>
        <span>Learn something new</span>
      </button>

      <button
        type="button"
        data-helper-answer="interest:volunteer"
      >
        <strong>Volunteering</strong>
        <span>Help on or off the beach</span>
      </button>

      <button
        type="button"
        data-helper-answer="interest:inclusive"
      >
        <strong>Inclusive programs</strong>
        <span>Adaptive or inclusive participation</span>
      </button>

      <button
        type="button"
        data-helper-answer="interest:any"
      >
        <strong>I'm not sure</strong>
        <span>Show me a broad range</span>
      </button>
    </div>

    <div class="club-helper__actions">
      <button
        type="button"
        class="club-helper__text-button"
        data-helper-back="age"
      >
        Back
      </button>
    </div>
  `;
}

function renderHelperLocationStep() {
  const content =
    getHelperContentElement();

  if (!content) {
    return;
  }

  const existingOriginField =
    document.querySelector(
      "[data-location-field]"
    );

  const existingOrigin =
    existingOriginField
      ? existingOriginField.value
      : "";

  content.innerHTML = `
    ${getHelperStepLabel(3)}

    <h3 class="club-helper__question">
      Where are you?
    </h3>

    <p class="club-helper__message">
      We'll use this to find the closest matches.
    </p>

    <label class="club-helper__field">
      <span>Suburb or town</span>

      <input
        type="text"
        data-helper-location-input
        data-location-list-id="sa-location-options"
        placeholder="Start typing a suburb or town"
        autocomplete="off"
        value="${escapeHtml(existingOrigin)}"
      >
    </label>

    <div class="club-helper__options">
      <button
        type="button"
        data-helper-location-continue
      >
        <strong>Use this location</strong>
      </button>

      <button
        type="button"
        data-helper-location-current
      >
        <strong>Use my current location</strong>
      </button>

      <button
        type="button"
        data-helper-location-skip
      >
        <strong>Skip for now</strong>
      </button>
    </div>

    <p
      class="club-helper__hint"
      data-helper-location-message
    >
      Type at least 4 characters and select a suggestion.
    </p>

    <div class="club-helper__actions">
      <button
        type="button"
        class="club-helper__text-button"
        data-helper-back="interest"
      >
        Back
      </button>
    </div>
  `;

  const helperLocationInput =
    content.querySelector(
      "[data-helper-location-input]"
    );

  if (helperLocationInput) {
    updateLocationAutocompleteState(
      helperLocationInput
    );

    helperLocationInput.focus();
  }
}

function getVisibleClubRecommendations(
  limit
) {
  const cards =
    Array.from(
      document.querySelectorAll(
        "[data-club-card]"
      )
    ).filter(function (card) {
      return !card.hidden;
    });

  const origin =
    getSelectedOrigin();

  const sorted =
    cards.slice().sort(
      function (a, b) {
        if (origin) {
          const aDistance =
            toNumber(
              a.dataset.distance
            );

          const bDistance =
            toNumber(
              b.dataset.distance
            );

          if (
            aDistance === null &&
            bDistance === null
          ) {
            return String(
              a.dataset.title || ""
            ).localeCompare(
              String(
                b.dataset.title || ""
              )
            );
          }

          if (aDistance === null) {
            return 1;
          }

          if (bDistance === null) {
            return -1;
          }

          return (
            aDistance -
            bDistance
          );
        }

        return String(
          a.dataset.title || ""
        ).localeCompare(
          String(
            b.dataset.title || ""
          )
        );
      }
    );

  return sorted.slice(
    0,
    limit || 3
  );
}

function getCardRecommendationData(
  card
) {
  const title =
    card.dataset.title ||
    "Surf Life Saving club";

  const summaryElement =
    card.querySelector(
      ".club-card__summary"
    );

  const distanceElement =
    card.querySelector(
      "[data-card-distance]"
    );

  const profileLink =
    card.querySelector(
      ".club-card__actions a[href], .club-card__body h2 a[href]"
    );

  const leadButton =
    card.querySelector(
      "[data-lead-club]"
    );

  return {
    title: title,
    summary: summaryElement
      ? summaryElement.textContent.trim()
      : "",
    distance: distanceElement
      ? distanceElement.textContent.trim()
      : "",
    profileUrl: profileLink
      ? profileLink.getAttribute("href")
      : "#",
    clubSlug: leadButton
      ? leadButton.getAttribute(
          "data-lead-club"
        )
      : ""
  };
}

function renderHelperResults() {
  applyHelperFilters();

  const content =
    getHelperContentElement();

  if (!content) {
    return;
  }

  const visibleCards =
    getVisibleClubRecommendations(4);

  const countElement =
    document.querySelector(
      "[data-results-count]"
    );

  const visibleCount =
    countElement
      ? countElement.textContent
      : String(
          visibleCards.length
        );

  const origin =
    getSelectedOrigin();

  if (
    visibleCards.length === 0
  ) {
    content.innerHTML = `
      <div class="club-helper__result-header">
        <h3 class="club-helper__question">
          No close match yet
        </h3>
      </div>

      <p class="club-helper__message">
        Try a wider search or change one of your answers.
      </p>

      <div class="club-helper__options">
        <button
          type="button"
          data-helper-broaden-search
        >
          <strong>Broaden the search</strong>
        </button>

        <button
          type="button"
          data-helper-start-over
        >
          <strong>Start again</strong>
        </button>
      </div>
    `;

    return;
  }

  const recommendationHtml =
    visibleCards
      .map(function (card) {
        const data =
          getCardRecommendationData(
            card
          );

        const distanceText =
          origin &&
          data.distance &&
          data.distance !==
            "Distance unavailable"
            ? `<span>${escapeHtml(data.distance)}</span>`
            : "";

        return `
          <article class="club-helper__recommendation">
            <div>
              <h4>${escapeHtml(data.title)}</h4>
              ${distanceText}

              ${
                data.summary
                  ? `<p>${escapeHtml(data.summary)}</p>`
                  : ""
              }
            </div>

            <div class="club-helper__recommendation-actions">
              <a href="${escapeHtml(data.profileUrl)}">
                View profile
              </a>

              <button
                type="button"
                data-lead-club="${escapeHtml(data.clubSlug)}"
                data-helper-club-title="${escapeHtml(data.title)}"
              >
                Send my details
              </button>
            </div>
          </article>
        `;
      })
      .join("");

  content.innerHTML = `
    <div class="club-helper__result-header">
      <h3 class="club-helper__question">
        Your closest matches
      </h3>
    </div>

    <p class="club-helper__message">
      ${escapeHtml(visibleCount)} clubs match your answers. Here are some places to start.
    </p>

    <div class="club-helper__recommendations">
      ${recommendationHtml}
    </div>

    <div class="club-helper__actions club-helper__actions--split">
      <button
        type="button"
        class="club-helper__text-button"
        data-helper-back="location"
      >
        Back
      </button>

      <button
        type="button"
        class="club-helper__text-button"
        data-helper-start-over
      >
        Start again
      </button>
    </div>
  `;
}

function broadenHelperSearch() {
  const radiusField =
    document.querySelector(
      "[data-filter='radius']"
    );

  if (radiusField) {
    radiusField.value = "100";
  }

  applyFilters();
  renderHelperResults();
}

function openClubHelper() {
  const panel =
    getHelperPanelElement();

  if (!panel) {
    return false;
  }

  panel.hidden = false;
  renderHelperStart();

  return true;
}

function openClubHelperFromHeader() {
  const targetUrlButton =
    document.querySelector(
      "[data-open-club-helper]"
    );

  const targetUrl =
    targetUrlButton
      ? targetUrlButton.getAttribute(
          "data-helper-target-url"
        )
      : "/?helper=open#clubs";

  if (!openClubHelper()) {
    window.location.href =
      targetUrl ||
      "/?helper=open#clubs";
  }
}

document.addEventListener(
  "input",
  function (event) {
    if (
      event.target.matches(
        "[data-location-field]"
      )
    ) {
      clearStoredCurrentLocation();

      updateLocationAutocompleteState(
        event.target
      );

      applyFilters();
      return;
    }

    if (
      event.target.matches(
        "[data-helper-location-input]"
      )
    ) {
      updateLocationAutocompleteState(
        event.target
      );
    }
  }
);

document.addEventListener(
  "focusin",
  function (event) {
    if (
      event.target.matches(
        "[data-location-field]"
      ) ||
      event.target.matches(
        "[data-helper-location-input]"
      )
    ) {
      updateLocationAutocompleteState(
        event.target
      );
    }
  }
);

document.addEventListener(
  "change",
  function (event) {
    if (
      event.target.matches(
        "[data-location-field]"
      )
    ) {
      updateLocationAutocompleteState(
        event.target
      );

      applyFilters();
      return;
    }

    if (
      event.target.matches(
        "select[data-filter]"
      )
    ) {
      applyFilters();
      return;
    }

    if (
      event.target.matches(
        "input[data-filter-check]"
      )
    ) {
      handleCheckboxChange(
        event.target
      );

      applyFilters();
      return;
    }

    if (
      event.target.matches(
        "[data-sort-clubs]"
      )
    ) {
      applyFilters();
    }
  }
);

document.addEventListener(
  "click",
  function (event) {
    const openHeaderHelper =
      event.target.closest(
        "[data-open-club-helper]"
      );

    if (openHeaderHelper) {
      event.preventDefault();
      openClubHelperFromHeader();
      return;
    }

    const openPromoHelper =
      event.target.closest(
        "[data-club-guide-open]"
      );

    if (openPromoHelper) {
      openClubHelper();
      return;
    }

    const clearButton =
      event.target.closest(
        "[data-clear-filters]"
      );

    if (clearButton) {
      clearFilters();
      return;
    }

    const currentLocationButton =
      event.target.closest(
        "[data-use-current-location]"
      );

    if (currentLocationButton) {
      useCurrentLocation();
      return;
    }

    const helperAnswer =
      event.target.closest(
        "[data-helper-answer]"
      );

    if (helperAnswer) {
      const answer =
        helperAnswer.getAttribute(
          "data-helper-answer"
        );

      const parts =
        answer.split(":");

      const key = parts[0];
      const value = parts[1];

      if (key === "age") {
        helperState.age = value;
        renderHelperInterestStep();
        return;
      }

      if (key === "interest") {
        helperState.interest =
          value;

        renderHelperLocationStep();
        return;
      }
    }

    const helperBack =
      event.target.closest(
        "[data-helper-back]"
      );

    if (helperBack) {
      const step =
        helperBack.getAttribute(
          "data-helper-back"
        );

      if (step === "age") {
        renderHelperAgeStep();
        return;
      }

      if (step === "interest") {
        renderHelperInterestStep();
        return;
      }

      if (step === "location") {
        renderHelperLocationStep();
        return;
      }
    }

    const helperLocationContinue =
      event.target.closest(
        "[data-helper-location-continue]"
      );

    if (helperLocationContinue) {
      const helperLocationInput =
        document.querySelector(
          "[data-helper-location-input]"
        );

      const originField =
        document.querySelector(
          "[data-location-field]"
        );

      const message =
        document.querySelector(
          "[data-helper-location-message]"
        );

      const value =
        helperLocationInput
          ? helperLocationInput.value.trim()
          : "";

      if (!value) {
        if (message) {
          message.textContent =
            "Enter a suburb or town, or skip this step.";

          message.dataset.statusType =
            "warning";
        }

        return;
      }

      if (!findLocationByInput(value)) {
        if (message) {
          message.textContent =
            "Select a location from the suggestions.";

          message.dataset.statusType =
            "warning";
        }

        return;
      }

      clearStoredCurrentLocation();

      if (originField) {
        originField.value = value;

        updateLocationAutocompleteState(
          originField
        );
      }

      const radiusField =
        document.querySelector(
          "[data-filter='radius']"
        );

      if (
        radiusField &&
        !radiusField.value
      ) {
        radiusField.value = "25";
      }

      helperState.location =
        "suburb";

      renderHelperResults();
      return;
    }

    const helperLocationCurrent =
      event.target.closest(
        "[data-helper-location-current]"
      );

    if (helperLocationCurrent) {
      helperState.location =
        "current";

      useCurrentLocation(
        function (success) {
          if (success) {
            const radiusField =
              document.querySelector(
                "[data-filter='radius']"
              );

            if (
              radiusField &&
              !radiusField.value
            ) {
              radiusField.value =
                "25";
            }

            renderHelperResults();
          }
        }
      );

      return;
    }

    const helperLocationSkip =
      event.target.closest(
        "[data-helper-location-skip]"
      );

    if (helperLocationSkip) {
      const originField =
        document.querySelector(
          "[data-location-field]"
        );

      if (originField) {
        originField.value = "";

        updateLocationAutocompleteState(
          originField
        );
      }

      const radiusField =
        document.querySelector(
          "[data-filter='radius']"
        );

      if (radiusField) {
        radiusField.value = "";
      }

      clearStoredCurrentLocation();

      helperState.location =
        "any";

      renderHelperResults();
      return;
    }

    const broadenSearchButton =
      event.target.closest(
        "[data-helper-broaden-search]"
      );

    if (broadenSearchButton) {
      broadenHelperSearch();
      return;
    }

    const helperStartOver =
      event.target.closest(
        "[data-helper-start-over]"
      );

    if (helperStartOver) {
      renderHelperStart();
      return;
    }

    const leadButton =
      event.target.closest(
        "[data-lead-club]"
      );

    if (leadButton) {
      const clubSlug =
        leadButton.getAttribute(
          "data-lead-club"
        );

      const clubTitle =
        getLeadClubTitle(
          leadButton
        );

      if (
        typeof window.openLeadForm ===
        "function"
      ) {
        window.openLeadForm({
          clubSlug: clubSlug,
          clubTitle: clubTitle
        });
      }

      return;
    }

    const helperToggle =
      event.target.closest(
        "[data-helper-toggle]"
      );

    if (helperToggle) {
      const panel =
        getHelperPanelElement();

      if (panel) {
        panel.hidden =
          !panel.hidden;

        if (!panel.hidden) {
          renderHelperStart();
        }
      }

      return;
    }

    const helperClose =
      event.target.closest(
        "[data-helper-close]"
      );

    if (helperClose) {
      const panel =
        getHelperPanelElement();

      if (panel) {
        panel.hidden = true;
      }
    }
  }
);

document.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Escape") {
      const panel =
        getHelperPanelElement();

      if (
        panel &&
        !panel.hidden
      ) {
        panel.hidden = true;
      }
    }
  }
);

document.addEventListener(
  "DOMContentLoaded",
  function () {
    const initialParams =
      new URLSearchParams(
        window.location.search
      );

    populateNativeLocationDatalist();

    const originField =
      document.querySelector(
        "[data-location-field]"
      );

    if (originField) {
      updateLocationAutocompleteState(
        originField
      );
    }

    setFiltersFromUrl();
    applyFilters();

    if (
      initialParams.get("helper") ===
      "open"
    ) {
      openClubHelperFromHeader();
    }
  }
);