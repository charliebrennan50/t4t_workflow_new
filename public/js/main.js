// Render families into sections
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
                    `${c.gender} age ${c.age}` +
                    (c.special_requests ? ` — ${c.special_requests}` : "")
                )
                .join("<br>");
              return `<div class="family-row" onclick="handleClick('${f.control_number}', '${f.status || "approved"}')">
                        <strong>#${f.control_number}</strong><br><div class="mt-2">${kids}</div>
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

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split("\n");
    console.log(`Total lines: ${lines.length}`);

    let success = 0;
    let errors = 0;

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(",");
      if (values.length < 1) continue;

      const control_number = values[0].replace(/"/g, "").trim();
      if (!/^\d{7}$/.test(control_number)) continue;

      const family_comments =
        values.length > 1 ? values[1].replace(/"/g, "").trim() || null : null;

      try {
        // Save recipient
        await fetch("/api/import-recipient", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            control_number,
            family_comments,
          }),
        });

        // Save children — GENDER, AGE, COMMENTS repeating
        let col = 2; // start at first GENDER
        while (col + 2 < values.length) {
          const genderRaw = values[col]
            ? values[col].replace(/"/g, "").trim().toUpperCase()
            : "";
          const ageStr = values[col + 1]
            ? values[col + 1].replace(/"/g, "").trim()
            : "";
          const special_requests = values[col + 2]
            ? values[col + 2].replace(/"/g, "").trim() || null
            : null;

          if (genderRaw && ageStr && /^\d+$/.test(ageStr)) {
            const gender = genderRaw.includes("M") ? "Boy" : "Girl";
            const age = parseInt(ageStr, 10);

            await fetch("/api/import-child", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                control_number,
                gender,
                age,
                special_requests,
              }),
            });
          }
          col += 3; // move to next GENDER
        }

        success++;
      } catch (err) {
        errors++;
        console.error(`Line ${i + 1}:`, err);
      }
    }

    alert(`Import complete!\n${success} families saved\n${errors} errors`);
    location.reload();
  };

  reader.readAsText(file);
}

window.renderFamilies = renderFamilies;
window.showSection = showSection;
window.handleClick = handleClick;
window.searchControl = searchControl;
window.handleFileSelect = handleFileSelect;

renderFamilies();
showSection("approved"); // default
