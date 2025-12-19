const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    listNotes: (q) => ipcRenderer.invoke("notes:list", q),
    addNote: (note) => ipcRenderer.invoke("notes:add", note),
    deleteNote: (id) => ipcRenderer.invoke("notes:delete", id),
});
