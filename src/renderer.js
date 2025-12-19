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

    msg.className =
        type === "ok"
            ? "text-sm text-emerald-700"
            : "text-sm text-rose-700";
}

async function renderList() {
    const q = el("search").value;
    const notes = await window.api.listNotes(q);

    el("count").textContent = `Всего: ${notes.length}`;

    const list = el("list");
    list.innerHTML = "";

    if (!notes.length) {
        list.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
        Пока нет заметок.
      </div>
    `;
        return;
    }

    for (const n of notes) {
        const created = new Date(n.created_at).toLocaleString();

        const card = document.createElement("div");
        card.className = "rounded-2xl border border-slate-200 bg-white p-4";

        card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold text-slate-900 break-words">${escapeHtml(n.title)}</div>
          <div class="mt-2 text-slate-700 whitespace-pre-wrap break-words">${escapeHtml(n.content)}</div>
          <div class="mt-3 text-xs text-slate-500">ID: ${n.id} · ${created}</div>
        </div>

        <button
          class="shrink-0 rounded-xl px-3 py-2 bg-rose-600 text-white hover:bg-rose-500"
          data-id="${n.id}">
          Удалить
        </button>
      </div>
    `;

        card.querySelector("button").addEventListener("click", async (e) => {
            const id = Number(e.target.dataset.id);
            await window.api.deleteNote(id);
            await renderList();
        });

        list.appendChild(card);
    }
}

el("add").addEventListener("click", async () => {
    const title = el("title").value;
    const content = el("content").value;

    const res = await window.api.addNote({ title, content });

    if (!res.ok) {
        setMsg(res.error, "err");
        return;
    }

    setMsg("Сохранено!", "ok");
    el("title").value = "";
    el("content").value = "";
    await renderList();
});

el("refresh").addEventListener("click", renderList);

let searchTimer;
el("search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderList, 200);
});

renderList();
