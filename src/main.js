const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { openDb, getAttachmentsDir } = require("./db");

let db = null;
let mainWindow = null;

function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeTrim(s) {
    return String(s ?? "").trim();
}

function createWindow() {
    if (mainWindow) return;

    mainWindow = new BrowserWindow({
        width: 1100,
        height: 720,
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
    });
}

app.whenReady().then(() => {
    db = openDb();
    ensureDir(getAttachmentsDir());
    createWindow();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
    try { if (db) db.close(); } catch {}
    app.quit();
});

ipcMain.handle("subjects:list", () => {
    return db.prepare("SELECT id, name FROM subjects ORDER BY name ASC").all();
});

ipcMain.handle("subjects:add", (_e, name) => {
    const n = safeTrim(name);
    if (!n) return { ok: false, error: "Введите название предмета." };

    try {
        const info = db.prepare("INSERT INTO subjects(name) VALUES (?)").run(n);
        return { ok: true, id: info.lastInsertRowid };
    } catch (err) {
        return { ok: false, error: "Такой предмет уже существует." };
    }
});

ipcMain.handle("entries:list", (_e, filters) => {
    const subjectId = Number(filters?.subjectId || 0);
    const q = safeTrim(filters?.q || "");

    if (!subjectId && !q) {
        return db.prepare(`
      SELECT e.id, e.topic, e.content, e.created_at, s.name AS subject
      FROM entries e
      JOIN subjects s ON s.id = e.subject_id
      ORDER BY e.id DESC
    `).all();
    }

    let sql = `
    SELECT e.id, e.topic, e.content, e.created_at, s.name AS subject
    FROM entries e
    JOIN subjects s ON s.id = e.subject_id
    WHERE 1=1
  `;
    const params = [];

    if (subjectId) {
        sql += " AND e.subject_id = ? ";
        params.push(subjectId);
    }
    if (q) {
        sql += " AND (e.topic LIKE ? OR e.content LIKE ? OR s.name LIKE ?) ";
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY e.id DESC";
    return db.prepare(sql).all(...params);
});

ipcMain.handle("entries:add", (_e, entry) => {
    const subjectId = Number(entry?.subjectId || 0);
    const topic = safeTrim(entry?.topic);
    const content = safeTrim(entry?.content);

    if (!subjectId) return { ok: false, error: "Выберите предмет." };
    if (!topic || !content) return { ok: false, error: "Заполните тему и конспект." };

    const createdAt = new Date().toISOString();
    const info = db
        .prepare("INSERT INTO entries(subject_id, topic, content, created_at) VALUES (?, ?, ?, ?)")
        .run(subjectId, topic, content, createdAt);

    return { ok: true, id: info.lastInsertRowid };
});

ipcMain.handle("entries:delete", (_e, id) => {
    const info = db.prepare("DELETE FROM entries WHERE id = ?").run(Number(id));
    return { ok: info.changes > 0 };
});

ipcMain.handle("attachments:list", (_e, entryId) => {
    return db.prepare(`
    SELECT id, entry_id, original_name, stored_name, stored_path, created_at
    FROM attachments
    WHERE entry_id = ?
    ORDER BY id DESC
  `).all(Number(entryId));
});

ipcMain.handle("attachments:add", async (_e, entryId) => {
    const eid = Number(entryId);
    if (!eid) return { ok: false, error: "Сначала сохраните запись." };

    const res = await dialog.showOpenDialog(mainWindow, {
        title: "Выберите файл",
        properties: ["openFile"]
    });

    if (res.canceled || !res.filePaths?.length) return { ok: false, error: "Выбор отменён." };

    const sourcePath = res.filePaths[0];
    const originalName = path.basename(sourcePath);

    const attachmentsDir = getAttachmentsDir();
    ensureDir(attachmentsDir);

    const ext = path.extname(originalName);
    const storedName = crypto.randomBytes(16).toString("hex") + ext;
    const storedPath = path.join(attachmentsDir, storedName);

    try {
        fs.copyFileSync(sourcePath, storedPath);
    } catch (err) {
        return { ok: false, error: "Не удалось скопировать файл." };
    }

    const createdAt = new Date().toISOString();
    const info = db.prepare(`
    INSERT INTO attachments(entry_id, original_name, stored_name, stored_path, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(eid, originalName, storedName, storedPath, createdAt);

    return { ok: true, id: info.lastInsertRowid };
});

ipcMain.handle("attachments:open", (_e, attachmentId) => {
    const row = db.prepare("SELECT stored_path FROM attachments WHERE id = ?").get(Number(attachmentId));
    if (!row?.stored_path) return { ok: false, error: "Файл не найден." };

    shell.openPath(row.stored_path);
    return { ok: true };
});

ipcMain.handle("attachments:delete", (_e, attachmentId) => {
    const id = Number(attachmentId);
    const row = db.prepare("SELECT stored_path FROM attachments WHERE id = ?").get(id);
    if (!row?.stored_path) return { ok: false, error: "Файл не найден." };

    db.prepare("DELETE FROM attachments WHERE id = ?").run(id);

    try { fs.unlinkSync(row.stored_path); } catch {}
    return { ok: true };
});
