const el = (id) => document.getElementById(id);

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setMsg(text, type) {
    const msg = el("msg");
    msg.textContent = text;
    msg.className = type === "ok" ? "text-sm text-emerald-700" : "text-sm text-rose-700";
}

let selectedEntryId = 0;

async function loadSubjects() {
    const subjects = await window.api.listSubjects();
    const select = el("subjectSelect");
    const filter = el("filterSubject");

    select.innerHTML = `<option value="0">Выберите предмет...</option>`;
    filter.innerHTML = `<option value="0">Все предметы</option>`;

    for (const s of subjects) {
        const opt1 = document.createElement("option");
        opt1.value = String(s.id);
        opt1.textContent = s.name;
        select.appendChild(opt1);

        const opt2 = document.createElement("option");
        opt2.value = String(s.id);
        opt2.textContent = s.name;
        filter.appendChild(opt2);
    }
}

async function renderEntries() {
    const q = el("search").value;
    const subjectId = Number(el("filterSubject").value || 0);

    const rows = await window.api.listEntries({ q, subjectId });

    el("count").textContent = `Всего: ${rows.length}`;
    const list = el("entries");
    list.innerHTML = "";

    if (!rows.length) {
        list.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
        Пока нет записей.
      </div>`;
        return;
    }

    for (const r of rows) {
        const created = new Date(r.created_at).toLocaleString();

        const card = document.createElement("div");
        card.className = "rounded-2xl border border-slate-200 bg-white p-4";

        const isSelected = selectedEntryId === r.id;

        card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs text-slate-500">${escapeHtml(r.subject)} · ${created}</div>
          <div class="mt-1 font-semibold break-words ${isSelected ? "underline" : ""}">
            ${escapeHtml(r.topic)}
          </div>
          <div class="mt-2 text-slate-700 line-clamp-3 whitespace-pre-wrap break-words">
            ${escapeHtml(r.content)}
          </div>
          <div class="mt-3 flex gap-2">
            <button class="selectBtn rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800" data-id="${r.id}">
              Выбрать
            </button>
            <button class="delBtn rounded-xl px-3 py-2 bg-rose-600 text-white hover:bg-rose-500" data-id="${r.id}">
              Удалить
            </button>
          </div>
        </div>
      </div>
    `;

        card.querySelector(".selectBtn").addEventListener("click", async (e) => {
            selectedEntryId = Number(e.target.dataset.id);
            await renderAttachments();
            updateAttachButton();
            await renderEntries();
        });

        card.querySelector(".delBtn").addEventListener("click", async (e) => {
            const id = Number(e.target.dataset.id);
            await window.api.deleteEntry(id);
            if (selectedEntryId === id) {
                selectedEntryId = 0;
                await renderAttachments();
                updateAttachButton();
            }
            await renderEntries();
        });

        list.appendChild(card);
    }
}

function updateAttachButton() {
    const btn = el("attachBtn");
    if (selectedEntryId) {
        btn.disabled = false;
        btn.className = "w-full rounded-xl px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500";
        btn.textContent = "Прикрепить файл к выбранной записи";
    } else {
        btn.disabled = true;
        btn.className = "w-full rounded-xl px-4 py-2 bg-slate-200 text-slate-500 cursor-not-allowed";
        btn.textContent = "Прикрепить файл (сначала выбери запись)";
    }
}

async function renderAttachments() {
    const box = el("attachments");
    box.innerHTML = "";

    if (!selectedEntryId) {
        box.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
        Выберите запись справа, чтобы увидеть вложения.
      </div>`;
        return;
    }

    const files = await window.api.listAttachments(selectedEntryId);

    if (!files.length) {
        box.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
        Вложений пока нет.
      </div>`;
        return;
    }

    for (const f of files) {
        const row = document.createElement("div");
        row.className = "rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-2";

        row.innerHTML = `
      <div class="min-w-0">
        <div class="font-medium break-words">${escapeHtml(f.original_name)}</div>
        <div class="text-xs text-slate-500">ID: ${f.id}</div>
      </div>
      <div class="flex gap-2 shrink-0">
        <button class="openBtn rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800" data-id="${f.id}">Открыть</button>
        <button class="delBtn rounded-xl px-3 py-2 bg-rose-600 text-white hover:bg-rose-500" data-id="${f.id}">Удалить</button>
      </div>
    `;

        row.querySelector(".openBtn").addEventListener("click", async (e) => {
            await window.api.openAttachment(Number(e.target.dataset.id));
        });

        row.querySelector(".delBtn").addEventListener("click", async (e) => {
            await window.api.deleteAttachment(Number(e.target.dataset.id));
            await renderAttachments();
        });

        box.appendChild(row);
    }
}

el("addSubjectBtn").addEventListener("click", async () => {
    const name = el("newSubject").value;

    const res = await window.api.addSubject(name);
    if (!res.ok) return setMsg(res.error, "err");

    setMsg("Предмет добавлен.", "ok");
    el("newSubject").value = "";
    await loadSubjects();
});

el("saveEntry").addEventListener("click", async () => {
    const subjectId = Number(el("subjectSelect").value || 0);
    const topic = el("topic").value;
    const content = el("content").value;

    const res = await window.api.addEntry({ subjectId, topic, content });

    if (!res.ok) return setMsg(res.error, "err");

    setMsg("Запись сохранена. Выберите её справа для вложений.", "ok");
    el("topic").value = "";
    el("content").value = "";

    await renderEntries();
});

el("content").addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        el("saveEntry").click();
    }
});

el("attachBtn").addEventListener("click", async () => {
    if (!selectedEntryId) return;

    const res = await window.api.addAttachment(selectedEntryId);
    if (!res.ok) return setMsg(res.error, "err");

    setMsg("Файл прикреплён.", "ok");
    await renderAttachments();
});

el("refresh").addEventListener("click", async () => {
    await loadSubjects();
    await renderEntries();
    await renderAttachments();
    updateAttachButton();
});

let timer;
el("search").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(renderEntries, 200);
});

el("filterSubject").addEventListener("change", renderEntries);

(async function init() {
    await loadSubjects();
    await renderEntries();
    await renderAttachments();
    updateAttachButton();
})();
