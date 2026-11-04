function printReceipt(htmlContent, forPc) {
  const printWindow = window.open("", "", "width=640,height=360");
  const pcStyle = `
    <style>
      @media print {
        @page { size: 4in 2in; margin: 0; }
        html, body { width: 4in; margin: 0; padding: 0; }
        .pc-sheet { display: contents; }
        .label.pc {
          width: 4in;
          height: 2in;
          max-height: 2in;
          margin: 0;
          padding: 0.12in 0.16in;
          position: static;
          transform: none;
          overflow: hidden;
          writing-mode: vertical-rl;
          text-orientation: sideways;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          page-break-after: always;
          break-after: page;
        }
        .label.pc:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .label.pc .pc-rot {
          writing-mode: vertical-rl;
          text-orientation: sideways;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          position: static;
          width: auto;
          height: auto;
          margin: 0;
          transform: none;
        }
      }
    </style>`;
  printWindow.document.write(`
    <html>
      <head>
        <title>Print 4x2${forPc ? " PC" : ""}</title>
        <link rel="stylesheet" href="/styles/styles.css">
        ${forPc ? pcStyle : ""}
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = () => { window.print(); window.close(); };
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function familyCommentHtml(family) {
  if (!family || !family.family_comment) return "";
  return `<p class="family-comment">${escapeHtml(family.family_comment)}</p>`;
}

function wrapPrintLines(text, width) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > width && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function shoppingCardLines(family) {
  const lines = [];
  const children = (family && family.children) || [];
  children.forEach((c) => {
    const head = `${c.gender} age ${c.age}`;
    if (c.special_requests) {
      wrapPrintLines(`${head} — ${c.special_requests}`, 42).forEach((t) =>
        lines.push({ kind: "kid", text: t })
      );
    } else {
      lines.push({ kind: "kid", text: head });
    }
  });
  if (family && family.family_comment) {
    wrapPrintLines(family.family_comment, 48).forEach((t) =>
      lines.push({ kind: "comment", text: t })
    );
  }
  return lines;
}

function printShoppingCard(forPc) {
  const control = document.getElementById("shopControl").textContent;
  const family = families.find((f) => f.control_number === control) || {
    children: [],
    family_comment: "",
  };
  const lines = shoppingCardLines(family);
  const LINES_PER_CARD = 6;
  const pages = [];
  if (!lines.length) {
    pages.push([]);
  } else {
    for (let i = 0; i < lines.length; i += LINES_PER_CARD) {
      pages.push(lines.slice(i, i + LINES_PER_CARD));
    }
  }

  const shopHtml = pages
    .map((pageLines, idx) => {
      const kidsHtml = pageLines
        .filter((l) => l.kind === "kid")
        .map((l) => escapeHtml(l.text))
        .join("<br>");
      const commentHtml = pageLines
        .filter((l) => l.kind === "comment")
        .map((l) => escapeHtml(l.text))
        .join("<br>");
      const cont =
        pages.length > 1
          ? `<p class="label-cont">${idx + 1} of ${pages.length}</p>`
          : "";
      return `
      <div class="${forPc ? "pc-sheet" : ""}">
      <div class="label${forPc ? " pc" : ""}">
        ${forPc ? '<div class="pc-rot">' : ""}
        <h1>${escapeHtml(control)}</h1>
        ${cont}
        ${kidsHtml ? `<p>${kidsHtml}</p>` : ""}
        ${commentHtml ? `<p class="family-comment">${commentHtml}</p>` : ""}
        ${forPc ? "</div>" : ""}
      </div>
      </div>`;
    })
    .join("");

  printReceipt(shopHtml, forPc);
}

// OPEN MODALS
function openShoppingModal(family) {
  document.getElementById("shopControl").textContent = family.control_number;
  document.getElementById("shopKids").innerHTML = family.children
    .map(
      (c) =>
        `<strong>${escapeHtml(c.gender)} age ${escapeHtml(c.age)}</strong>` +
        (c.special_requests
          ? `<br><em class="text-danger">${escapeHtml(c.special_requests)}</em>`
          : "")
    )
    .join("<br>");
  const commentEl = document.getElementById("shopComment");
  if (commentEl) {
    commentEl.textContent = family.family_comment || "";
    commentEl.style.display = family.family_comment ? "block" : "none";
  }
  new bootstrap.Modal(document.getElementById("shoppingModal")).show();
}

function openBagsModal(family) {
  document.getElementById("bagsControl").textContent = family.control_number;
  const numChildren = family.children.length || 1;
  document.getElementById("numToys").value = numChildren * 4;
  document.getElementById("numBooks").value = numChildren;
  document.getElementById("numStuffers").value = numChildren;
  new bootstrap.Modal(document.getElementById("bagsModal")).show();
}

function openPickupModal(family) {
  document.getElementById("pickupControl").textContent = family.control_number;
  document.getElementById("pickupBin").textContent = family.bin || "Ask staff";
  document.getElementById("pickupBags").textContent =
    family.bags || "Ask staff";
  new bootstrap.Modal(document.getElementById("pickupModal")).show();
}

function printBagLabels(forPc) {
  const control = document.getElementById("bagsControl").textContent;
  const bags = parseInt(document.getElementById("numBags").value) || 1;
  const bin = document.getElementById("binLocation").value.trim() || "UNKNOWN";

  let labelsHtml = "";
  for (let i = 1; i <= bags; i++) {
    labelsHtml += `
      <div class="${forPc ? "pc-sheet" : ""}">
      <div class="label${forPc ? " pc" : ""}">
      ${forPc ? '<div class="pc-rot">' : ""}
      <h1>${escapeHtml(control)}</h1>
      <p>Bag ${i} of ${bags}</p>
      <p>Bin: ${escapeHtml(bin)}</p>
      ${forPc ? "</div>" : ""}
     </div>
     </div>
    `;
  }

  printReceipt(labelsHtml, forPc);
}

function printPickupCard() {
  const control = document.getElementById("pickupControl").textContent;
  const bin = document.getElementById("pickupBin").textContent;
  const bags = document.getElementById("pickupBags").textContent;

  const pickupHtml = `
      <div class="label">
        <h1>${escapeHtml(control)}</h1>
        <p>Bin: ${escapeHtml(bin)}</p>
        <p>Bags: ${escapeHtml(bags)}</p>
      </div>
    `;

  printReceipt(pickupHtml);
}

// SAVE / STATUS FUNCTIONS
async function finalizeShopping() {
  const control = document.getElementById("shopControl").textContent;

  await fetch("/api/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      control_number: control,
      status: "being_shopped",
    }),
  });

  location.reload();
}

async function saveBagsAndDistribution() {
  const control = document.getElementById("bagsControl").textContent;
  const bags = parseInt(document.getElementById("numBags").value) || 1;
  const bin = document.getElementById("binLocation").value.trim() || "UNKNOWN";
  const toys = parseInt(document.getElementById("numToys").value) || 0;
  const books = parseInt(document.getElementById("numBooks").value) || 0;
  const stuffers = parseInt(document.getElementById("numStuffers").value) || 0;

  await fetch("/api/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      control_number: control,
      status: "ready_for_pickup",
      bags,
      bin,
      toys,
      books,
      stuffers,
    }),
  });

  location.reload();
}

async function finalizePickup() {
  const control = document.getElementById("pickupControl").textContent;

  const today = new Date().toISOString().slice(0, 10);

  await fetch("/api/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      control_number: control,
      status: "complete",
      pickup_date: today,
    }),
  });

  location.reload();
}
