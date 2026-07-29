// =========================================================================
// STARRYBOARD DISBOARD-STYLE SEARCH ENGINE
// =========================================================================
const BACKEND_API_BASE = 'https://manager-bot-1-6167.onrender.com';

const state = {
    currentPage: 1,
    pageSize: 12,
    totalItems: 0,
    totalPages: 0,
    sortBy: 'bumped',
    allowNsfw: false,
    searchQuery: ''
};

const serverGrid = document.getElementById('serverGrid');
const paginationContainer = document.getElementById('paginationContainer');
const totalServerCount = document.getElementById('totalServerCount');
const sortSelect = document.getElementById('sortSelect');
const nsfwToggle = document.getElementById('nsfwToggle');

window.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchHighlight = document.getElementById('searchHighlight');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput && searchHighlight) {
        const urlParams = new URLSearchParams(window.location.search);
        const queryParam = urlParams.get('q') || '';
        if (queryParam) {
            searchInput.value = queryParam;
            state.searchQuery = queryParam;
            searchHighlight.textContent = `"${queryParam}"`;
        }

        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim();
            searchHighlight.textContent = state.searchQuery ? `"${state.searchQuery}"` : '""';
            loadServerData(1);
        });

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                state.searchQuery = '';
                searchHighlight.textContent = '""';
                loadServerData(1);
            });
        }
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            loadServerData(1);
        });
    }

    if (nsfwToggle) {
        nsfwToggle.addEventListener('change', (e) => {
            state.allowNsfw = e.target.checked;
            loadServerData(1);
        });
    }

    loadServerData(1);
});

async function loadServerData(page = 1) {
    state.currentPage = page;

    try {
        const queryParams = new URLSearchParams({
            page: page,
            limit: state.pageSize,
            sort: state.sortBy,
            nsfw: state.allowNsfw ? 1 : 0,
            q: state.searchQuery
        });

        const response = await fetch(`${BACKEND_API_BASE}/api/v1/servers?${queryParams.toString()}`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const result = await response.json();
        const backendData = result && result.data ? result.data : {};

        const totalItems = typeof backendData.total === 'number' ? backendData.total : 0;
        const serversList = Array.isArray(backendData.list) ? backendData.list : [];

        if (totalServerCount) totalServerCount.textContent = totalItems.toLocaleString();
        renderPagination(totalItems, page, state.pageSize);
        renderServerCards(serversList);

    } catch (error) {
        if (totalServerCount) totalServerCount.textContent = "0";
        renderServerCards([]);
        renderPagination(0, 1, state.pageSize);
    }
}

function renderServerCards(serversList) {
    if (!serverGrid) return;

    if (!Array.isArray(serversList) || serversList.length === 0) {
        serverGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #8a8f9d; padding: 60px 0;">
                <i class="fa-solid fa-server" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5;"></i>
                <p>No active servers found with current filters.</p>
            </div>`;
        return;
    }

    serverGrid.innerHTML = serversList.map((server) => {
        const name = server.name || 'Unnamed Server';
        const icon = server.icon || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const onlineCount = typeof server.onlineCount === 'number' ? server.onlineCount.toLocaleString() : '10';
        const bumpedTime = server.bumpedTime || 'recently';
        const rating = typeof server.rating === 'number' ? server.rating : 5.0;
        const reviewCount = typeof server.reviewCount === 'number' ? server.reviewCount : 1;
        const description = server.description || 'No description provided for this server.';
        const tags = Array.isArray(server.tags) ? server.tags : [];
        const inviteUrl = server.inviteUrl || '#';

        return `
        <div class="sb-card">
            <div>
                <div class="sb-card-header">
                    <img src="${icon}" alt="${escapeHtml(name)}" class="sb-server-icon" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    <div style="min-width: 0; flex: 1;">
                        <div class="sb-card-meta">
                            <span class="sb-online-badge"><span class="sb-online-dot"></span> ${onlineCount} Online</span>
                            <span>• ${bumpedTime}</span>
                        </div>
                        <div class="sb-server-name">${escapeHtml(name)}</div>
                    </div>
                </div>
                <div class="sb-card-body">
                    <div class="sb-rating">
                        ${renderStars(rating)}
                        <span>(${reviewCount} bumps)</span>
                    </div>
                    ${tags.length > 0 ? `
                        <div class="sb-tags">
                            ${tags.map(tag => `<span class="sb-tag">${escapeHtml(String(tag).toUpperCase())}</span>`).join('')}
                        </div>
                    ` : ''}
                    <p class="sb-card-description">${escapeHtml(description)}</p>
                </div>
            </div>
            <div class="sb-card-footer">
                <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" class="sb-btn-join" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; width: 100%;">
                    <i class="fa-brands fa-discord"></i> Join Server
                </a>
            </div>
        </div>`;
    }).join('');
}

function renderStars(rating = 5.0) {
    let starsHtml = '';
    for (let i = 0; i < 5; i++) starsHtml += `<i class="fa-solid fa-star" style="color: #f1c40f;"></i>`;
    return starsHtml;
}

function renderPagination(totalItems = 0, currentPage = 1, pageSize = 12) {
    if (!paginationContainer) return;
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="sb-page-btn ${i === currentPage ? 'active' : ''}" onclick="loadServerData(${i})">${i}</button>`;
    }
    paginationContainer.innerHTML = html;
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}