const path = require("path");
const { app } = require("electron");
const Database = require("better-sqlite3");

function openDb() {
    const dbPath = path.join(app.getPath("userData"), "notes.db");
    const db = new Database(dbPath);

    db.exec(`
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    `);

    return db;
}

module.exports = { openDb };
