const express = require('express');
const cors = require('cors');
const ServerListing = require('../models/ServerListing');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 10000;

    app.use(cors());
    app.use(express.json());

    // 1. THE API ENDPOINT (Sends server data to the frontend)
    app.get('/api/servers', async (req, res) => {
        try {
            // Fetch top 50 servers sorted by newest bump first!
            const servers = await ServerListing.find()
                .sort({ lastBump: -1 })
                .limit(50);
            res.json(servers);
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch servers' });
        }
    });

    // 2. THE FRONTEND WEBSITE (Served directly from the bot!)
    app.get('/', (req, res) => {
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Starry | Global Server List</title>
            <style>
                body {
                    margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #1e1f22; color: #dcddde; display: flex; flex-direction: column; align-items: center;
                }
                header {
                    width: 100%; background-color: #2b2d31; padding: 20px 0; text-align: center;
                    border-bottom: 2px solid #5865F2; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                h1 { margin: 0; color: #fff; font-size: 2.5rem; }
                h1 span { color: #5865F2; }
                .container { width: 90%; max-width: 1200px; margin-top: 40px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
                .card {
                    background-color: #2b2d31; border-radius: 12px; width: 320px; padding: 20px;
                    box-shadow: 0 8px 15px rgba(0,0,0,0.2); transition: transform 0.2s;
                    display: flex; flex-direction: column; align-items: center; text-align: center;
                }
                .card:hover { transform: translateY(-5px); border-bottom: 2px solid #5865F2; }
                .icon { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; background-color: #1e1f22; }
                .name { font-size: 1.4rem; font-weight: bold; color: #fff; margin: 0 0 10px 0; }
                .desc { font-size: 0.95rem; color: #b5bac1; margin-bottom: 15px; height: 60px; overflow: hidden; }
                .stats { display: flex; gap: 15px; font-size: 0.9rem; font-weight: bold; color: #949ba4; margin-bottom: 15px; }
                .tags { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px; }
                .tag { background-color: #1e1f22; padding: 4px 10px; border-radius: 16px; font-size: 0.8rem; color: #5865F2; }
                .join-btn {
                    background-color: #5865F2; color: white; text-decoration: none; padding: 10px 20px;
                    border-radius: 4px; font-weight: bold; width: 80%; transition: background 0.2s;
                }
                .join-btn:hover { background-color: #4752c4; }
                .bump-time { font-size: 0.8rem; color: #80848e; margin-top: 15px; }
            </style>
        </head>
        <body>
            <header>
                <h1><span>Starry</span> Global Network</h1>
                <p>Discover the best communities across Discord</p>
            </header>
            <div class="container" id="server-list">
                <p>Loading servers...</p>
            </div>

            <script>
                async function loadServers() {
                    const res = await fetch('/api/servers');
                    const servers = await res.json();
                    const container = document.getElementById('server-list');
                    container.innerHTML = '';

                    if(servers.length === 0) { container.innerHTML = '<p>No servers bumped yet. Be the first to run /bump!</p>'; return; }

                    servers.forEach(s => {
                        const defaultIcon = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        const timeAgo = new Date(s.lastBump).toLocaleString();
                        
                        let tagsHtml = s.tags.map(t => \`<span class="tag">\${t}</span>\`).join('');
                        
                        container.innerHTML += \`
                            <div class="card">
                                <img src="\${s.iconUrl || defaultIcon}" class="icon" alt="Icon">
                                <h2 class="name">\${s.name}</h2>
                                <p class="desc">\${s.description}</p>
                                <div class="stats">
                                    <span>👥 \${s.memberCount} Members</span>
                                    <span>🚀 \${s.bumps} Bumps</span>
                                </div>
                                <div class="tags">\${tagsHtml}</div>
                                <a href="\${s.inviteLink}" target="_blank" class="join-btn">Join Server</a>
                                <span class="bump-time">Last bumped: \${timeAgo}</span>
                            </div>
                        \`;
                    });
                }
                loadServers();
            </script>
        </body>
        </html>
        `;
        res.send(html);
    });

    app.listen(port, () => {
        console.log(`🌐 Starry Web Dashboard live on Port ${port}!`);
    });
};
