const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { openDb } = require("./db");

let db = null;
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 950,
        height: 650,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, "index.html"));

    mainWindow.on("closed", () => {
        mainWindow = null;
        app.quit();
    });
}

app.whenReady().then(() => {
    db = openDb();
    createWindow();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on("window-all-closed", () => {
    try {
        if (db) db.close();
    } catch (e) {}
});

app.whenReady().then(() => {
    db = openDb();
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("notes:list", (_event, q) => {
    const query = (q || "").trim();
    if (!query) {
        return db.prepare("SELECT * FROM notes ORDER BY id DESC").all();
    }
    return db
        .prepare(
            `SELECT * FROM notes
       WHERE title LIKE ? OR content LIKE ?
       ORDER BY id DESC`
        )
        .all(`%${query}%`, `%${query}%`);
});

ipcMain.handle("notes:add", (_event, { title, content }) => {
    const t = (title || "").trim();
    const c = (content || "").trim();

    if (!t || !c) {
        return { ok: false, error: "Заполните заголовок и текст." };
    }

    const createdAt = new Date().toISOString();
    const info = db
        .prepare("INSERT INTO notes(title, content, created_at) VALUES (?, ?, ?)")
        .run(t, c, createdAt);

    return { ok: true, id: info.lastInsertRowid };
});

ipcMain.handle("notes:delete", (_event, id) => {
    const info = db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    return { ok: info.changes > 0 };
});
