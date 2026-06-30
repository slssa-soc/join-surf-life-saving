document.addEventListener("click", function (event) {
  const button = event.target.closest("[data-lead-club]");

  if (!button) {
    return;
  }

  const clubSlug = button.getAttribute("data-lead-club");

  alert("The Send My Details form will be added next. Selected club: " + clubSlug);
});
