/**
 * QuickSnippets - Logic
 */

// --- Storage Wrapper ---
const storage = {
    async get() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get(['quickSnippetsData'], (result) => {
                    resolve(result.quickSnippetsData || { folders: [] });
                });
            });
        } else {
            // Fallback for web preview
            const data = localStorage.getItem('quickSnippetsData');
            return data ? JSON.parse(data) : { folders: [] };
        }
    },
    async set(data) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ quickSnippetsData: data }, () => {
                    resolve();
                });
            });
        } else {
            // Fallback for web preview
            localStorage.setItem('quickSnippetsData', JSON.stringify(data));
        }
    }
};

// --- State ---
let state = {
    folders: [],
    currentFolderId: null, // null means root (folder list)
    isSearching: false,
    searchQuery: '',
    editingItem: null // { type: 'folder'|'snippet', id, folderId }
};

// --- DOM Elements ---
const searchInput = document.getElementById('searchInput');
const closeBtn = document.getElementById('closeBtn');
const backBtn = document.getElementById('backBtn');
const homeBtn = document.getElementById('homeBtn');
const folderNameBreadcrumb = document.getElementById('folderName');
const listView = document.getElementById('listView');
const addBtn = document.getElementById('addBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const itemNameInput = document.getElementById('itemName');
const itemContentGroup = document.getElementById('snippetContentGroup');
const itemContentInput = document.getElementById('itemContent');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const toast = document.getElementById('toast');

// --- Initialization ---
async function init() {
    const data = await storage.get();
    state.folders = data.folders || [];
    render();
}

// --- Rendering ---
function render() {
    listView.innerHTML = '';
    
    if (state.isSearching) {
        renderSearch();
        return;
    }

    if (state.currentFolderId === null) {
        renderFolders();
    } else {
        renderSnippets();
    }
}

function renderFolders() {
    homeBtn.classList.add('active');
    folderNameBreadcrumb.classList.add('hidden');
    backBtn.classList.add('hidden');
    addBtn.innerHTML = '<span class="icon">+</span> Add Folder';

    if (state.folders.length === 0) {
        listView.innerHTML = `
            <div class="empty-state">
                <span class="icon">📁</span>
                <p>No folders yet. Create one to get started!</p>
            </div>
        `;
        return;
    }

    state.folders.forEach(folder => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-info">
                <div class="card-title">📁 ${folder.name}</div>
                <div class="card-subtitle">${folder.snippets.length} snippets</div>
            </div>
            <div class="card-actions">
                <button class="action-btn edit" data-id="${folder.id}" title="Edit">✏️</button>
                <button class="action-btn delete" data-id="${folder.id}" title="Delete">🗑️</button>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) return;
            navigateToFolder(folder.id);
        });

        card.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openModal('folder', folder);
        });

        card.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFolder(folder.id);
        });

        listView.appendChild(card);
    });
}

function renderSnippets() {
    const folder = state.folders.find(f => f.id === state.currentFolderId);
    if (!folder) {
        navigateToHome();
        return;
    }

    homeBtn.classList.remove('active');
    folderNameBreadcrumb.classList.remove('hidden');
    folderNameBreadcrumb.textContent = folder.name;
    folderNameBreadcrumb.classList.add('active');
    backBtn.classList.remove('hidden');
    addBtn.innerHTML = '<span class="icon">+</span> Add Snippet';

    if (folder.snippets.length === 0) {
        listView.innerHTML = `
            <div class="empty-state">
                <span class="icon">📝</span>
                <p>This folder is empty. Add your first snippet!</p>
            </div>
        `;
        return;
    }

    folder.snippets.forEach(snippet => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-info">
                <div class="card-title">${snippet.title}</div>
                <div class="card-subtitle">${snippet.content}</div>
            </div>
            <div class="card-actions">
                <button class="action-btn copy" data-id="${snippet.id}" title="Copy to Clipboard">📋</button>
                <button class="action-btn edit" data-id="${snippet.id}" title="Edit">✏️</button>
                <button class="action-btn delete" data-id="${snippet.id}" title="Delete">🗑️</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) return;
            copyToClipboard(snippet.content);
        });

        card.querySelector('.copy').addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(snippet.content);
        });

        card.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openModal('snippet', snippet);
        });

        card.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSnippet(snippet.id);
        });

        listView.appendChild(card);
    });
}

function renderSearch() {
    homeBtn.classList.remove('active');
    folderNameBreadcrumb.classList.remove('hidden');
    folderNameBreadcrumb.textContent = `Search: "${state.searchQuery}"`;
    folderNameBreadcrumb.classList.add('active');
    backBtn.classList.remove('hidden');
    addBtn.classList.add('hidden');

    const results = [];
    state.folders.forEach(folder => {
        folder.snippets.forEach(snippet => {
            if (snippet.title.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                snippet.content.toLowerCase().includes(state.searchQuery.toLowerCase())) {
                results.push({ ...snippet, folderName: folder.name });
            }
        });
    });

    if (results.length === 0) {
        listView.innerHTML = `
            <div class="empty-state">
                <span class="icon">🔍</span>
                <p>No snippets found matching "${state.searchQuery}"</p>
            </div>
        `;
        return;
    }

    results.forEach(snippet => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-info">
                <div class="card-title">${snippet.title}</div>
                <div class="card-subtitle">${snippet.content}</div>
            </div>
            <div class="card-actions">
                <button class="action-btn copy" title="Copy">📋</button>
            </div>
        `;

        card.addEventListener('click', () => copyToClipboard(snippet.content));
        listView.appendChild(card);
    });
}

// --- Actions ---
function navigateToFolder(id) {
    state.currentFolderId = id;
    state.isSearching = false;
    searchInput.value = '';
    render();
}

function navigateToHome() {
    state.currentFolderId = null;
    state.isSearching = false;
    searchInput.value = '';
    addBtn.classList.remove('hidden');
    render();
}

async function saveFolder(name) {
    if (state.editingItem) {
        const folder = state.folders.find(f => f.id === state.editingItem.id);
        if (folder) folder.name = name;
    } else {
        state.folders.push({
            id: Date.now().toString(),
            name: name,
            snippets: []
        });
    }
    await storage.set({ folders: state.folders });
    closeModal();
    render();
}

async function deleteFolder(id) {
    if (!confirm('Are you sure you want to delete this folder and all its snippets?')) return;
    state.folders = state.folders.filter(f => f.id !== id);
    await storage.set({ folders: state.folders });
    render();
}

async function saveSnippet(title, content) {
    const folder = state.folders.find(f => f.id === state.currentFolderId);
    if (!folder) return;

    if (state.editingItem) {
        const snippet = folder.snippets.find(s => s.id === state.editingItem.id);
        if (snippet) {
            snippet.title = title;
            snippet.content = content;
        }
    } else {
        folder.snippets.push({
            id: Date.now().toString(),
            title: title,
            content: content
        });
    }
    await storage.set({ folders: state.folders });
    closeModal();
    render();
}

async function deleteSnippet(id) {
    if (!confirm('Are you sure you want to delete this snippet?')) return;
    const folder = state.folders.find(f => f.id === state.currentFolderId);
    if (folder) {
        folder.snippets = folder.snippets.filter(s => s.id !== id);
        await storage.set({ folders: state.folders });
        render();
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast();
    });
}

function showToast() {
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

// --- Modal Logic ---
function openModal(type, item = null) {
    state.editingItem = item ? { type, id: item.id } : null;
    modalOverlay.classList.remove('hidden');
    
    if (type === 'folder') {
        modalTitle.textContent = item ? 'Edit Folder' : 'Add Folder';
        itemContentGroup.classList.add('hidden');
        itemNameInput.value = item ? item.name : '';
        itemNameInput.focus();
    } else {
        modalTitle.textContent = item ? 'Edit Snippet' : 'Add Snippet';
        itemContentGroup.classList.remove('hidden');
        itemNameInput.value = item ? item.title : '';
        itemContentInput.value = item ? item.content : '';
        itemNameInput.focus();
    }
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    state.editingItem = null;
    itemNameInput.value = '';
    itemContentInput.value = '';
}

// --- Event Listeners ---
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
        state.isSearching = true;
        state.searchQuery = query;
    } else {
        state.isSearching = false;
        state.searchQuery = '';
        addBtn.classList.remove('hidden');
    }
    render();
});

homeBtn.addEventListener('click', navigateToHome);
backBtn.addEventListener('click', navigateToHome);

addBtn.addEventListener('click', () => {
    if (state.currentFolderId === null) {
        openModal('folder');
    } else {
        openModal('snippet');
    }
});

cancelBtn.addEventListener('click', closeModal);

saveBtn.addEventListener('click', () => {
    const name = itemNameInput.value.trim();
    if (!name) return;

    if (itemContentGroup.classList.contains('hidden')) {
        saveFolder(name);
    } else {
        const content = itemContentInput.value.trim();
        if (!content) return;
        saveSnippet(name, content);
    }
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Start the app
closeBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        window.close();
    } else {
        alert('In a real browser, the extension popup would close now.');
    }
});

init();
