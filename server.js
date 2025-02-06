import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Student Profile Endpoints
app.get("/api/students/search", async (req, res) => {
  try {
    const searchTerm = req.query.q;
    const [rows] = await pool.execute(
      `SELECT * FROM students 
       WHERE hall_ticket_number = ? OR name LIKE ?`,
      [searchTerm, `%${searchTerm}%`]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error searching student:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch students by year, branch, and section
app.get("/api/students/:year/:branch/:section", async (req, res) => {
  try {
    const { year, branch, section } = req.params;
    const [students] = await pool.execute(
      "SELECT * FROM students WHERE year = ? AND branch = ? AND section = ?",
      [year, branch, section]
    );
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Academic Batches Endpoints
app.get("/api/academic-batches", async (req, res) => {
  try {
    const { batch_year, semester, year, branch } = req.query;
    const [sections] = await pool.execute(
      "SELECT * FROM academic_batches WHERE batch_year = ? AND semester = ? AND year = ? AND branch = ? AND is_active = true",
      [parseInt(batch_year), semester, parseInt(year), branch]
    );

    if (sections.length === 0) {
      return res.status(404).json({ error: "No sections found" });
    }

    res.json(sections);
  } catch (error) {
    console.error("Error in /api/academic-batches:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch unmarked training sessions
app.get("/api/unmarked-sessions", async (req, res) => {
  try {
    const { batch_year, semester, year, branch, section } = req.query;

    const [sessions] = await pool.execute(
      `SELECT ts.* 
       FROM training_sessions ts
       LEFT JOIN attendance a ON ts.id = a.session_id
       WHERE ts.batch_year = ?
       AND ts.semester = ?
       AND ts.year = ?
       AND ts.branch = ?
       AND ts.section = ?
       AND a.session_id IS NULL
       ORDER BY ts.date, ts.start_time`,
      [batch_year, semester, year, branch, section]
    );

    res.json(sessions);
  } catch (error) {
    console.error("Error fetching unmarked sessions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit attendance
app.post("/api/attendance", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { sessionId, absentStudents } = req.body;
    await connection.beginTransaction();

    // Get all students for this session
    const [sessionDetails] = await connection.execute(
      "SELECT year, branch, section FROM training_sessions WHERE id = ?",
      [sessionId]
    );

    if (sessionDetails.length === 0) {
      throw new Error("Invalid session ID");
    }

    const { year, branch, section } = sessionDetails[0];

    // Get all students in the section
    const [students] = await connection.execute(
      "SELECT id FROM students WHERE year = ? AND branch = ? AND section = ?",
      [year, branch, section]
    );

    // Mark attendance for all students
    for (const student of students) {
      const status = absentStudents.includes(student.id) ? "absent" : "present";
      await connection.execute(
        "INSERT INTO attendance (student_id, session_id, status) VALUES (?, ?, ?)",
        [student.id, sessionId, status]
      );
    }

    await connection.commit();
    res.json({ message: "Attendance marked successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("Error marking attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release();
  }
});

// Training Sessions Endpoints
app.get("/api/training-sessions", async (req, res) => {
  try {
    const { batch_year, semester, year, branch, section } = req.query;
    const [sessions] = await pool.execute(
      "SELECT * FROM training_sessions WHERE batch_year = ? AND semester = ? AND year = ? AND branch = ? AND section = ? ORDER BY date, start_time",
      [batch_year, semester, year, branch, section]
    );
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching training sessions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Training Schedules Endpoints
app.get("/api/training-schedules", async (req, res) => {
  try {
    const { branch } = req.query;
    const [schedules] = await pool.execute(
      `
      SELECT 
        ts.*,
        start_slots.start_time,
        start_slots.end_time,
        end_slots.end_time as period_end_time
      FROM training_schedules ts
      JOIN time_slots start_slots 
        ON ts.start_period = start_slots.period_number 
        AND start_slots.year = ts.year
      JOIN time_slots end_slots 
        ON ts.end_period = end_slots.period_number 
        AND end_slots.year = ts.year
      WHERE ts.branch = ?
      ORDER BY ts.year, ts.section, ts.day_of_week, ts.start_period
    `,
      [branch]
    );
    res.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create Training Schedule
app.post("/api/training-schedules", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      batch_year,
      semester,
      year,
      branch,
      section,
      day_of_week,
      start_period,
      end_period,
    } = req.body;
    await connection.beginTransaction();

    // First verify that the time slots exist for this year
    const [slots] = await connection.execute(
      `SELECT COUNT(*) as count 
       FROM time_slots 
       WHERE year = ? AND period_number IN (?, ?)`,
      [year, start_period, end_period]
    );

    if (slots[0].count !== 2) {
      throw new Error(`Invalid time slots for year ${year}`);
    }

    await connection.execute(
      `INSERT INTO training_schedules 
       (batch_year, semester, year, branch, section, day_of_week, start_period, end_period) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batch_year,
        semester,
        year,
        branch,
        section,
        day_of_week,
        start_period,
        end_period,
      ]
    );

    await connection.commit();
    res.json({ message: "Schedule created successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating schedule:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  } finally {
    connection.release();
  }
});

// Semester Dates Endpoints
app.post("/api/semester-dates", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { batch_year, year, semester, branch, start_date, end_date } =
      req.body;
    await connection.beginTransaction();

    await connection.execute(
      "INSERT INTO semester_dates (batch_year, year, semester, branch, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE start_date = VALUES(start_date), end_date = VALUES(end_date)",
      [batch_year, year, semester, branch, start_date, end_date]
    );

    const [schedules] = await connection.execute(
      `SELECT ts.*, 
        start_slots.start_time, 
        end_slots.end_time
       FROM training_schedules ts 
       JOIN time_slots start_slots 
         ON ts.start_period = start_slots.period_number 
         AND start_slots.year = ts.year
       JOIN time_slots end_slots 
         ON ts.end_period = end_slots.period_number 
         AND end_slots.year = ts.year 
       WHERE ts.batch_year = ? AND ts.year = ? AND ts.semester = ? AND ts.branch = ?`,
      [batch_year, year, semester, branch]
    );

    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);

    for (const schedule of schedules) {
      let currentDate = new Date(startDateObj);

      while (currentDate <= endDateObj) {
        if (currentDate.getDay() === schedule.day_of_week) {
          await connection.execute(
            `INSERT INTO training_sessions 
             (batch_year, year, semester, branch, section, date, start_time, end_time, is_generated) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)`,
            [
              batch_year,
              year,
              semester,
              branch,
              schedule.section,
              currentDate,
              schedule.start_time,
              schedule.end_time,
            ]
          );
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    await connection.commit();
    res.json({
      message: "Semester dates saved and sessions generated successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error saving semester dates:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release();
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
