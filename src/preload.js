const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    listSubjects: () => ipcRenderer.invoke("subjects:list"),
    addSubject: (name) => ipcRenderer.invoke("subjects:add", name),

    listEntries: (filters) => ipcRenderer.invoke("entries:list", filters),
    addEntry: (entry) => ipcRenderer.invoke("entries:add", entry),
    deleteEntry: (id) => ipcRenderer.invoke("entries:delete", id),

    listAttachments: (entryId) => ipcRenderer.invoke("attachments:list", entryId),
    addAttachment: (entryId) => ipcRenderer.invoke("attachments:add", entryId),
    openAttachment: (attachmentId) => ipcRenderer.invoke("attachments:open", attachmentId),
    deleteAttachment: (attachmentId) => ipcRenderer.invoke("attachments:delete", attachmentId),
});
