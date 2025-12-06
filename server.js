require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./views");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:Meaghan1@localhost:5432/t4t_workflow",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
             COALESCE(json_agg(json_build_object('gender', c.gender, 'age', c.age, 'special_requests', c.special_requests) ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), '[]') AS children
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
  const { control_number, status, bags, bin } = req.body;

  try {
    if (bags !== undefined && bin !== undefined) {
      // Being Shopped: write bags and bin once
      await pool.query(
        `UPDATE recipients SET status=$1, bags=$2, bin=$3 WHERE control_number=$4`,
        [status, bags, bin, control_number]
      );
    } else {
      // Only update status
      await pool.query(
        `UPDATE recipients SET status=$1 WHERE control_number=$2`,
        [status, control_number]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));