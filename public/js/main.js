// Render families into sections
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFamilies() {
  const groups = {
    approved: [],
    being_shopped: [],
    ready_for_pickup: [],
    complete: [],
  };
  families.forEach((f) => {
    const key = f.status || "approved";
    if (groups[key]) groups[key].push(f);
  });

  Object.keys(groups).forEach((status) => {
    const container = document.getElementById(status);
    container.innerHTML =
      groups[status].length === 0
        ? '<p class="text-center text-muted my-5 fs-3">No families</p>'
        : groups[status]
            .map((f) => {
              const kids = f.children
                .map(
                  (c) =>
                    `${escapeHtml(c.gender)} age ${escapeHtml(c.age)}` +
                    (c.special_requests
                      ? ` — ${escapeHtml(c.special_requests)}`
                      : "")
                )
                .join("<br>");
              const comment =
                status === "approved" && f.family_comment
                  ? `<div class="mt-2 family-comment">${escapeHtml(
                      f.family_comment
                    )}</div>`
                  : "";
              return `<div class="family-row" onclick="handleClick('${escapeHtml(
                f.control_number
              )}', '${f.status || "approved"}')">
                        <strong>#${escapeHtml(f.control_number)}</strong><br><div class="mt-2">${kids}</div>${comment}
                    </div>`;
            })
            .join("");
  });
}

// Show only one section at a time
function showSection(section) {
  document
    .querySelectorAll(".status-section")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById(`section-${section}`).style.display = "block";
}

// Handle row clicks
function handleClick(control, status) {
  const family = families.find((f) => f.control_number === control);
  if (status === "approved") openShoppingModal(family);
  else if (status === "being_shopped") openBagsModal(family);
  else if (status === "ready_for_pickup") openPickupModal(family);
}

// Search function: navigate to section and scroll to row
function searchControl() {
  const input = document.getElementById("searchInput");
  let control = input.value.trim();
  if (/^\d{1,7}$/.test(control)) control = control.padStart(7, "2400");
  const family = families.find((f) => f.control_number === control);
  if (!family) {
    alert(`Control number ${control} not found`);
    return;
  }

  document
    .querySelectorAll(".family-row")
    .forEach((r) => r.classList.remove("highlight-search"));
  const sectionKey = family.status || "approved";
  showSection(sectionKey);

  const row = [...document.querySelectorAll(`#${sectionKey} .family-row`)].find(
    (r) => r.textContent.includes(control)
  );
  if (row) {
    row.classList.add("highlight-search");
    row.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  input.value = "";
}

document.getElementById("searchInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchControl();
});

window.renderFamilies = renderFamilies;
window.showSection = showSection;
window.handleClick = handleClick;
window.searchControl = searchControl;
window.escapeHtml = escapeHtml;

renderFamilies();
showSection("approved"); // default
