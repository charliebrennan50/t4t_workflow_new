function printReceipt(htmlContent) {
  const printWindow = window.open("", "", "width=380,height=600");
  printWindow.document.write(`
    <html>
      <head>
        <title>Print</title>
        <link rel="stylesheet" href="/styles/styles.css">
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

// OPEN MODALS
function openShoppingModal(family) {
  document.getElementById("shopControl").textContent = family.control_number;
  document.getElementById("shopKids").innerHTML = family.children
    .map(
      (c) =>
        `<strong>${c.gender} age ${c.age}</strong>` +
        (c.special_requests
          ? `<br><em class="text-danger">${c.special_requests}</em>`
          : "")
    )
    .join("<br>");
  new bootstrap.Modal(document.getElementById("shoppingModal")).show();
}

function openBagsModal(family) {
  document.getElementById("bagsControl").textContent = family.control_number;
  const numChildren = family.children.length || 1;
  // document.getElementById("numBags").value = 1;
  // document.getElementById("binLocation").value = "A12";
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

// PRINT FUNCTIONS
function printShoppingCard() {
  const control = document.getElementById("shopControl").textContent;
  const family = families.find((f) => f.control_number === control);
  const kids = family.children
    .map(
      (c) =>
        `${c.gender} age ${c.age}` +
        (c.special_requests ? ` — ${c.special_requests}` : "")
    )
    .join("<br>");

  shopHtml = `
      <div class="label">
        <h1>${control}</h1>
        <p>${kids}</p>
      </div>
    `;

  // printReceipt(
  //   `TOYS FOR TOTS SOUTH BREVARD\nCONTROL: ${control}\n${kids}\nThank you!`
  // );

  printReceipt(shopHtml);
}

function printBagLabels() {
  const control = document.getElementById("bagsControl").textContent;
  const bags = parseInt(document.getElementById("numBags").value) || 1;
  const bin = document.getElementById("binLocation").value.trim() || "UNKNOWN";

  let labelsHtml = "";
  for (let i = 1; i <= bags; i++) {
    labelsHtml += `
      <div class="label">
      <h1>${control}</h1>
      <p>Bag ${i} of ${bags}</p>
      <p>Bin: ${bin}</p>
     </div>
    `;
  }

  printReceipt(labelsHtml);
}

function printPickupCard() {
  const control = document.getElementById("pickupControl").textContent;
  const bin = document.getElementById("pickupBin").textContent;
  const bags = document.getElementById("pickupBags").textContent;

  pickupHtml = `
      <div class="label">
        <h1>${control}</h1>
        <p>Bin: ${bin}</p>
        <p>Bags: ${bags}</p>
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
