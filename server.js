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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com")
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
      FROM recipients r
      LEFT JOIN children c ON r.control_number = c.control_number
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
        `UPDATE recipients SET status = $1 WHERE control_number = $2`,
        [status, control_number]
      );
    } else if (status === "complete") {
      await pool.query(
        `UPDATE recipients SET status = $1, pickup_date = $2 WHERE control_number = $3`,
        [status, pickup_date, control_number]
      );
    } else {
      await pool.query(
        `UPDATE recipients 
         SET status = $1, bags = $2, bin = $3, toys = $4, books = $5, stuffers = $6
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
    }

    res.json({ success: true });
    console.log(`[FINALIZE] Successfully updated control ${control_number}`);
  } catch (err) {
    console.error(`[FINALIZE] ERROR updating control ${control_number}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/import-recipient", async (req, res) => {
  const { control_number, family_comments, status } = req.body;

  try {
    await pool.query(
      `INSERT INTO recipients (control_number, status, family_comment)
       VALUES ($1, $2, $3)
       ON CONFLICT (control_number)
       DO UPDATE SET
         status = EXCLUDED.status,
         family_comment = EXCLUDED.family_comment`,
      [control_number, status || "approved", family_comments || null]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Import recipient error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/import-child", async (req, res) => {
  // console.log("Received import-child request:", req.body);

  const { control_number, gender, age, special_requests } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Ensure recipient exists (idempotent)
    await client.query(
      `INSERT INTO recipients (control_number, status)
       VALUES ($1, 'approved')
       ON CONFLICT (control_number) DO NOTHING`,
      [control_number]
    );

    // Insert child
    await client.query(
      `INSERT INTO children (control_number, gender, age, special_requests)
       VALUES ($1, $2, $3, $4)`,
      [control_number, gender, age, special_requests || null]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import child error:", err);
    res.status(500).json({ success: false });
  } finally {
    client.release();
  }
});

app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
