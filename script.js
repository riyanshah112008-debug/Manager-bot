// =========================================================================
// STARRYBOARD FRONTEND ENGINE
// =========================================================================
const DISCORD_CLIENT_ID = '1513589513648345368';

// If viewed on Netlify or locally, auto-target your Render backend API
const BACKEND_API_BASE = window.location.hostname.includes('onrender.com') 
    ? '' 
    : 'https://manager-bot-1-6167.onrender.com';

const CURRENT_ORIGIN = window.location.origin;
const REDIRECT_URI = encodeURIComponent(`${CURRENT_ORIGIN}/auth/callback.html`);
const SCOPES = encodeURIComponent('identify email guilds');
const DISCORD_AUTH_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${SCOPES}`;

document.addEventListener('DOMContentLoaded', () => {
    const loginElements = document.querySelectorAll('.sb-btn-login, .js-login-btn');
    loginElements.forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = DISCORD_AUTH_URL;
        });
    });

    checkUserSession();
    initHeroSearchEngine();
    loadHomeBumpedServers();
});

function checkUserSession() {
    const userSession = localStorage.getItem('sb_user');
    if (userSession) {
        try {
            const user = JSON.parse(userSession);
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            document.querySelectorAll('.sb-btn-login').forEach(btn => {
                btn.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid #00F2FE;" alt="User">
                        <span>${escapeHtml(user.username)}</span>
                    </div>`;
            });
        } catch (e) {
            localStorage.removeItem('sb_user');
        }
    }
}

function initHeroSearchEngine() {
    const heroSearchInput = document.getElementById('heroSearchInput');
    const heroSearchForm = document.getElementById('heroSearchForm');

    if (heroSearchForm) {
        heroSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = heroSearchInput ? heroSearchInput.value.trim() : '';
            window.location.href = query ? `search.html?q=${encodeURIComponent(query)}` : 'search.html';
        });
    }
}

async function loadHomeBumpedServers() {
    const bumpedGrid = document.getElementById('recentlyBumpedGrid');
    if (!bumpedGrid) return;

    try {
        const response = await fetch(`${BACKEND_API_BASE}/api/v1/servers/recently-bumped?limit=6`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const result = await response.json();
        const serverList = (result && Array.isArray(result.data)) ? result.data : [];

        renderServerGrid(bumpedGrid, serverList);
    } catch (error) {
        console.error("Failed to load bumped servers:", error);
        bumpedGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #8a8f9d; padding: 50px 0;">
                <i class="fa-solid fa-rocket" style="font-size: 2.5rem; margin-bottom: 15px; color: #00F2FE;"></i>
                <h3 style="color: #fff; margin-bottom: 8px;">No Recently Bumped Servers</h3>
                <p>Run <code style="background: #2b2d31; padding: 2px 8px; border-radius: 4px; color: #fff;">/bump</code> with Starry in your Discord server!</p>
            </div>`;
    }
}

function renderServerGrid(container, serversList) {
    if (!Array.isArray(serversList) || serversList.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #8a8f9d; padding: 50px 0;">
                <p>No recently bumped servers found.</p>
            </div>`;
        return;
    }

    container.innerHTML = serversList.map((server) => {
        const name = server.name || 'Unnamed Server';
        const icon = server.icon || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const onlineCount = typeof server.onlineCount === 'number' ? server.onlineCount.toLocaleString() : '10';
        const bumpedTime = server.bumpedTime || 'recently';
        const rating = typeof server.rating === 'number' ? server.rating : 5.0;
        const reviewCount = typeof server.reviewCount === 'number' ? server.reviewCount : 1;
        const description = server.description || 'A vibrant community on Starryboard!';
        const tags = Array.isArray(server.tags) && server.tags.length > 0 ? server.tags : ['community'];
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
                        <i class="fa-solid fa-star" style="color: #f1c40f;"></i>
                        <i class="fa-solid fa-star" style="color: #f1c40f;"></i>
                        <i class="fa-solid fa-star" style="color: #f1c40f;"></i>
                        <i class="fa-solid fa-star" style="color: #f1c40f;"></i>
                        <i class="fa-solid fa-star" style="color: #f1c40f;"></i>
                        <span>(${reviewCount} bumps)</span>
                    </div>
                    <div class="sb-tags">
                        ${tags.map(tag => `<span class="sb-tag">${escapeHtml(String(tag).toUpperCase())}</span>`).join('')}
                    </div>
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

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
