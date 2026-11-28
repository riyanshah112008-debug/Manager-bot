// 你的 Discord Bot ID
const BOT_CLIENT_ID = '1513589513648345368';
const API_BASE_URL = 'http://localhost:5000/api';

// 生成邀请机器人链接
const getInviteUrl = (guildId) => {
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    return `https://discord.com/api/oauth2/authorize?client_id=${BOT_CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guildId}&redirect_uri=${redirectUri}&response_type=code`;
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. 安全检查
    const token = localStorage.getItem('starryboard_token');
    const savedUserStr = localStorage.getItem('starryboard_user');

    if (!token || !savedUserStr) {
        alert('Please log in to Discord first!');
        window.location.href = './index.html';
        return;
    }

    // 2. 清理 URL query 参数
    if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 3. 渲染用户信息
    try {
        const user = JSON.parse(savedUserStr);
        document.getElementById('userName').innerText = user.global_name || user.username;
        document.getElementById('userAvatar').src = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        document.getElementById('userProfile').style.display = 'flex';
    } catch (e) {
        console.error("解析用户信息失败", e);
    }

    // 4. 刷新服务器数据并渲染
    refreshServerData();

    // 5. 启动倒计时器

    // 6. 切回页面时自动检测并更新
    window.addEventListener('focus', () => {
        refreshServerData();
    });
});

/**
 * 刷新服务器数据（网络优先 -> 本地缓存降级）
 */
async function refreshServerData() {
    const token = localStorage.getItem('starryboard_token');

    if (token) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/guilds`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const latestGuilds = await response.json();
                localStorage.setItem('starryboard_guilds', JSON.stringify(latestGuilds));
            }
        } catch (err) {
            console.warn("拉取最新服务器状态失败，降级使用本地缓存:", err);
        }
    }

    renderServerGrid();
}

/**
 * 渲染服务器网格
 */
function renderServerGrid() {
    const serverGrid = document.getElementById('serverGrid');
    const savedGuilds = localStorage.getItem('starryboard_guilds');
    let guilds = [];

    try {
        guilds = savedGuilds ? JSON.parse(savedGuilds) : [];
    } catch (e) {
        console.error("解析服务器列表失败", e);
    }

    const manageableGuilds = guilds.filter(g => g.can_manage);

    if (manageableGuilds.length === 0) {
        serverGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; background: var(--card-bg); border-radius: 16px; border: 1px solid var(--card-border);">
                <i class="fa-solid fa-server" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>
                <p style="color: var(--text-muted); font-size: 16px;">No Discord servers found where you have management or invite permissions.</p>
            </div>`;
        return;
    }

    serverGrid.innerHTML = manageableGuilds.map(guild => {
        const iconUrl = guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';

        const hasBotInstalled = guild.has_bot !== undefined ? guild.has_bot : false;

        return createServerCardHtml(guild, iconUrl, hasBotInstalled);
    }).join('');
}

/**
 * 生成单个服务器卡片 HTML
 */
function createServerCardHtml(guild, iconUrl, hasBotInstalled) {
    return `
        <div class="server-card" data-guild-id="${guild.id}">
            <div>
                <div class="card-header">
                    <img class="server-icon" src="${iconUrl}" alt="${guild.name}">
                    <div class="server-info">
                        <div class="server-name" title="${guild.name}">${guild.name}</div>
                        <div class="server-status-tag">
                            <span class="status-dot ${hasBotInstalled ? 'installed' : 'uninstalled'}"></span>
                            ${hasBotInstalled ? 'Bot Active' : 'Bot Not Added'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="card-actions">
                ${hasBotInstalled ? '' : `
                    <a class="btn btn-primary" style="width: 100%;" href="${getInviteUrl(guild.id)}" target="_blank" onclick="markBotAdding('${guild.id}')">
                        <i class="fa-solid fa-plus"></i> Add Bot to Server
                    </a>
                `}
            </div>
        </div>
    `;
}

function markBotAdding(guildId) {
    const savedGuilds = localStorage.getItem('starryboard_guilds');
    if (savedGuilds) {
        try {
            let guilds = JSON.parse(savedGuilds);
            guilds = guilds.map(g => {
                if (g.id === guildId) g.has_bot = true;
                return g;
            });
            localStorage.setItem('starryboard_guilds', JSON.stringify(guilds));
        } catch (e) {
            console.error("更新本地缓存失败", e);
        }
    }
}


function logout() {
    localStorage.removeItem('starryboard_token');
    localStorage.removeItem('starryboard_user');
    localStorage.removeItem('starryboard_guilds');
    window.location.href = './index.html';
}