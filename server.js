require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./views");

// const pool = new Pool({
//   connectionString:
//     process.env.DATABASE_URL ||
//     "postgres://postgres:Meaghan1@localhost:5432/t4t_workflow",
//   ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
// });

const databaseUrl = process.env.DATABASE_URL || "";
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("-a.") || databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

const session = require("express-session");

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.LOGIN_USER &&
    password === process.env.LOGIN_PASS
  ) {
    req.session.loggedIn = true;
    return res.redirect("/");
  }

  res.render("login", { error: "Invalid credentials" });
});

function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

app.use(requireLogin);

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// GET home page
app.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
             COALESCE(json_agg(json_build_object(
               'gender', c.gender, 
               'age', c.age, 
               'special_requests', c.special_requests
             ) ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), '[]') AS children
      FROM workflow.recipients r
      LEFT JOIN workflow.children c ON r.control_number = c.control_number
      GROUP BY r.id
      ORDER BY r.control_number
    `);
    res.render("index", { families: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.post("/api/finalize", async (req, res) => {
  const {
    control_number,
    status,
    bags,
    bin,
    toys,
    books,
    stuffers,
    pickup_date,
  } = req.body;

  try {
    if (status === "being_shopped") {
      await pool.query(
        `UPDATE workflow.recipients SET status = $1 WHERE control_number = $2`,
        [status, control_number]
      );
    } else if (status === "complete") {
      await pool.query(
        `UPDATE workflow.recipients
         SET status = $1,
             pickup_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
         WHERE control_number = $2`,
        [status, control_number]
      );
    } else if (status === "ready_for_pickup") {
      await pool.query(
        `UPDATE workflow.recipients
         SET status = $1,
             bags = $2,
             bin = $3,
             toys = $4,
             books = $5,
             stuffers = $6,
             shopped_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
         WHERE control_number = $7`,
        [
          status,
          bags || null,
          bin || null,
          toys || 0,
          books || 0,
          stuffers || 0,
          control_number,
        ]
      );
    } else {
      res.status(400).json({ success: false, error: "Unknown status" });
      return;
    }

    res.json({ success: true });
    console.log(`[FINALIZE] Successfully updated control ${control_number}`);
  } catch (err) {
    console.error(`[FINALIZE] ERROR updating control ${control_number}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/reports", async (req, res) => {
  const STATUSES = [
    "approved",
    "being_shopped",
    "ready_for_pickup",
    "complete",
  ];

  const shoppedDate = typeof req.query.shopped === "string" ? req.query.shopped.trim() : "";
  const pickupDate = typeof req.query.pickup === "string" ? req.query.pickup.trim() : "";
  const shoppedOk = /^\d{4}-\d{2}-\d{2}$/.test(shoppedDate);
  const pickupOk = /^\d{4}-\d{2}-\d{2}$/.test(pickupDate);

  try {
    const result = await pool.query(`
      SELECT
        COALESCE(status, 'approved') AS status,
        COUNT(*)::int AS family_count,
        COALESCE(SUM(toys), 0)::int AS toys,
        COALESCE(SUM(books), 0)::int AS books,
        COALESCE(SUM(stuffers), 0)::int AS stuffers
      FROM workflow.recipients
      GROUP BY COALESCE(status, 'approved')
    `);

    const counts = { approved: 0, being_shopped: 0, ready_for_pickup: 0, complete: 0, other: 0 };
    const items = { toys: 0, books: 0, stuffers: 0 };
    for (const row of result.rows) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
        counts[row.status] = row.family_count;
      } else {
        counts.other += row.family_count;
      }
      items.toys += row.toys;
      items.books += row.books;
      items.stuffers += row.stuffers;
    }

    const total = STATUSES.reduce((sum, key) => sum + counts[key], 0) + counts.other;

    let shopped = [];
    let shoppedError = null;
    if (shoppedDate && !shoppedOk) {
      shoppedError = "Enter a date as YYYY-MM-DD.";
    } else if (shoppedOk) {
      const shoppedResult = await pool.query(
        `SELECT control_number, status, bin, bags
         FROM workflow.recipients
         WHERE shopped_date = $1::date
         ORDER BY control_number`,
        [shoppedDate]
      );
      shopped = shoppedResult.rows;
    }

    let pickedUp = [];
    let pickupError = null;
    if (pickupDate && !pickupOk) {
      pickupError = "Enter a date as YYYY-MM-DD.";
    } else if (pickupOk) {
      const pickupResult = await pool.query(
        `SELECT control_number, status, bin, bags
         FROM workflow.recipients
         WHERE pickup_date::date = $1::date
         ORDER BY control_number`,
        [pickupDate]
      );
      pickedUp = pickupResult.rows;
    }

    res.render("reports", {
      error: null,
      counts,
      items,
      total,
      generatedAt: new Date(),
      shoppedDate,
      shopped,
      shoppedError,
      pickupDate,
      pickedUp,
      pickupError,
    });
  } catch (err) {
    console.error("[REPORTS] status totals:", err);
    res.status(500).render("reports", {
      error: "Could not load status totals. Database may be unreachable.",
      counts: { approved: 0, being_shopped: 0, ready_for_pickup: 0, complete: 0, other: 0 },
      items: { toys: 0, books: 0, stuffers: 0 },
      total: 0,
      generatedAt: new Date(),
      shoppedDate: "",
      shopped: [],
      shoppedError: null,
      pickupDate: "",
      pickedUp: [],
      pickupError: null,
    });
  }
});

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

app.get("/reports/csv", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.control_number,
        r.status,
        r.family_comment,
        r.bags,
        r.bin,
        r.toys,
        r.books,
        r.stuffers,
        r.shopped_date,
        r.pickup_date,
        string_agg(
          c.gender || ' age ' || c.age ||
          CASE
            WHEN c.special_requests IS NOT NULL AND btrim(c.special_requests) <> ''
            THEN ' — ' || c.special_requests
            ELSE ''
          END,
          '; ' ORDER BY c.id
        ) AS children
      FROM workflow.recipients r
      LEFT JOIN workflow.children c ON c.control_number = r.control_number
      GROUP BY r.id
      ORDER BY r.control_number
    `);

    const headers = [
      "control_number",
      "status",
      "family_comment",
      "bags",
      "bin",
      "toys",
      "books",
      "stuffers",
      "shopped_date",
      "pickup_date",
      "children",
    ];
    const lines = [headers.join(",")];
    for (const row of result.rows) {
      lines.push(headers.map((key) => csvCell(row[key])).join(","));
    }

    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
    }).format(new Date());
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="t4t_workflow_${day}.csv"`
    );
    res.send(lines.join("\r\n"));
  } catch (err) {
    console.error("[REPORTS] csv:", err);
    res.status(500).send("Could not build the CSV dump.");
  }
});

app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
