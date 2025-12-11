require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:Meaghan1@localhost:5432/t4t_workflow',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// GET home page
app.get('/', async (req, res) => {
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
    res.render('index', { families: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST: update status, bags, bin
// server.js
app.post("/api/finalize", async (req, res) => {
  const { control_number, status, bags, bin, toys, books, stuffers } = req.body;

  console.log(`[FINALIZE] Received: control=${control_number}, status=${status}, bags=${bags}, bin=${bin}, toys=${toys}, books=${books}, stuffers=${stuffers}`);

  try {
    if (status === "being_shopped" || status === "complete") {
      // Only update the status for these cases
      console.log(`[FINALIZE] Status-only update for control ${control_number}`);
      await pool.query(
        `UPDATE recipients SET status = $1 WHERE control_number = $2`,
        [status, control_number]
      );
    } else {
      // Update all fields (for initial save in being_shopped modal)
      console.log(`[FINALIZE] Full update for control ${control_number}`);
      await pool.query(
        `UPDATE recipients 
         SET status = $1, bags = $2, bin = $3, toys = $4, books = $5, stuffers = $6
         WHERE control_number = $7`,
        [status, bags || null, bin || null, toys || 0, books || 0, stuffers || 0, control_number]
      );
    }

    res.json({ success: true });
    console.log(`[FINALIZE] Successfully updated control ${control_number}`);
  } catch (err) {
    console.error(`[FINALIZE] ERROR updating control ${control_number}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// // POST: save distribution (toys/books/stuffers), only once
// app.post('/api/distribution', async (req, res) => {
//   const { control_number, toys, books, stuffers } = req.body;
//   try {
//     await pool.query(
//       `INSERT INTO distribution (control_number, toys, books, stuffers)
//        VALUES ($1, $2, $3, $4)
//        ON CONFLICT (control_number) DO NOTHING`,
//       [control_number, toys, books, stuffers]
//     );
//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false });
//   }
// });

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));