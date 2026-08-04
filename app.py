from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time

app = Flask(__name__)
CORS(app)

DISCORD_CLIENT_ID = '1513589513648345368'
DISCORD_CLIENT_SECRET = '4pyd65kgsM8P5ZZxQmIzrkauh_zJV0yc'
DISCORD_BOT_TOKEN = 'MTUxMzU4OTUxMzY0ODM0NTM2OA.Gi6XY-.05DzsXzq1yJAAiPMSNyA7h4lYaVmkMMupL_knA'
REDIRECT_URI = 'http://localhost:3000/auth/callback.html'

ADMINISTRATOR_PERMISSION = 0x8
MANAGE_GUILD_PERMISSION = 0x20


# ==============================================================================
# 💡 数据库抽象接口层 (Database Abstraction Layer)
# ==============================================================================
class DB:
    # 临时内存数据库 (模拟数据库表结构)
    _users = {}  # { user_id: { id, username, avatar, last_login } }
    _guilds = {}  # { guild_id: { id, name, icon, description, tags, language, is_public, is_nsfw, last_bump_time, next_bump_time } }

    @classmethod
    def save_user(cls, user_data):
        """保存或更新用户信息"""
        cls._users[user_data['id']] = {
            "id": user_data['id'],
            "username": user_data.get('username'),
            "global_name": user_data.get('global_name'),
            "avatar": user_data.get('avatar'),
            "updated_at": int(time.time())
        }

    @classmethod
    def get_guild_meta(cls, guild_id):
        """获取单个服务器在 Starry 数据库中的元数据"""
        return cls._guilds.get(guild_id, {
            "id": guild_id,
            "name": "Server",
            "icon": "",
            "description": "",
            "tags": [],
            "language": "en",
            "is_public": True,
            "is_nsfw": False,
            "last_bump_time": 0,
            "next_bump_time": 0
        })

    @classmethod
    def save_guild_meta(cls, guild_id, data):
        """保存/更新服务器元数据"""
        if guild_id not in cls._guilds:
            cls._guilds[guild_id] = cls.get_guild_meta(guild_id)

        cls._guilds[guild_id].update(data)

    @classmethod
    def get_recently_bumped_guilds(cls, limit=6):
        """🔥 新增：获取最近 Bump 的全站服务器列表（按 last_bump_time 倒序排列）"""
        all_guilds = list(cls._guilds.values())

        # 只要是公开的（is_public 为 True），按 last_bump_time 倒序
        public_guilds = [g for g in all_guilds if g.get('is_public', True)]
        public_guilds.sort(key=lambda x: x.get('last_bump_time', 0), reverse=True)

        return public_guilds[:limit]


DB = DB()  # 实例化


# ==============================================================================
# Discord API 辅助函数
# ==============================================================================
def check_can_manage_bot(guild):
    if guild.get('owner'):
        return True
    permissions = int(guild.get('permissions', '0'))
    has_admin = (permissions & ADMINISTRATOR_PERMISSION) == ADMINISTRATOR_PERMISSION
    has_manage_guild = (permissions & MANAGE_GUILD_PERMISSION) == MANAGE_GUILD_PERMISSION
    return has_admin or has_manage_guild


def get_bot_guild_ids():
    bot_headers = {'Authorization': f'Bot {DISCORD_BOT_TOKEN}'}
    try:
        res = requests.get('https://discord.com/api/v10/users/@me/guilds', headers=bot_headers)
        if res.status_code == 200:
            return {g['id'] for g in res.json()}
        return set()
    except Exception as e:
        print("请求 Discord API 查询 Bot 服务器异常:", e)
        return set()


# ==============================================================================
# API 路由
# ==============================================================================

@app.route('/api/auth/discord', methods=['POST'])
def discord_auth():
    data = request.get_json()
    code = data.get('code')
    if not code:
        return jsonify({'error': 'No code provided'}), 400

    try:
        token_url = 'https://discord.com/api/v10/oauth2/token'
        token_data = {
            'client_id': DISCORD_CLIENT_ID,
            'client_secret': DISCORD_CLIENT_SECRET,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': REDIRECT_URI
        }
        token_headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        token_response = requests.post(token_url, data=token_data, headers=token_headers)
        token_json = token_response.json()
        if token_response.status_code != 200:
            return jsonify({'error': 'Failed to exchange code for token', 'details': token_json}), 400

        access_token = token_json.get('access_token')
        auth_headers = {'Authorization': f'Bearer {access_token}'}

        user_response = requests.get('https://discord.com/api/v10/users/@me', headers=auth_headers)
        user_data = user_response.json()
        DB.save_user(user_data)

        guilds_response = requests.get('https://discord.com/api/v10/users/@me/guilds', headers=auth_headers)
        guilds_data = guilds_response.json()
        bot_guild_ids = get_bot_guild_ids()

        processed_guilds = []
        if isinstance(guilds_data, list):
            for guild in guilds_data:
                gid = guild['id']
                can_manage = check_can_manage_bot(guild)
                has_bot = gid in bot_guild_ids

                # 同步服务器的基础信息（名称、图标等）到 DB
                DB.save_guild_meta(gid, {
                    "id": gid,
                    "name": guild.get('name'),
                    "icon": guild.get('icon')
                })

                meta = DB.get_guild_meta(gid)

                guild['can_manage'] = can_manage
                guild['has_bot'] = has_bot
                guild['last_bump_time'] = meta.get('last_bump_time', 0)
                guild['next_bump_time'] = meta.get('next_bump_time', 0)
                guild['description'] = meta.get('description', '')
                guild['tags'] = meta.get('tags', [])
                processed_guilds.append(guild)

        # 同样做一次 Bump 倒计时/最近 Bump 的排序
        processed_guilds.sort(key=lambda x: x.get('last_bump_time', 0), reverse=True)

        return jsonify({
            "message": "登录成功",
            "token": access_token,
            "user": user_data,
            "guilds": processed_guilds
        }), 200

    except Exception as e:
        print("服务器内部错误:", str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/guilds', methods=['GET'])
def get_user_guilds():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'Missing authorization token'}), 401

    try:
        guilds_response = requests.get('https://discord.com/api/v10/users/@me/guilds',
                                       headers={'Authorization': auth_header})
        if guilds_response.status_code != 200:
            return jsonify({'error': 'Failed to fetch user guilds'}), guilds_response.status_code

        guilds_data = guilds_response.json()
        bot_guild_ids = get_bot_guild_ids()
        processed_guilds = []

        if isinstance(guilds_data, list):
            for guild in guilds_data:
                gid = guild['id']
                can_manage = check_can_manage_bot(guild)
                has_bot = gid in bot_guild_ids

                # 更新/同步信息
                DB.save_guild_meta(gid, {
                    "id": gid,
                    "name": guild.get('name'),
                    "icon": guild.get('icon')
                })

                meta = DB.get_guild_meta(gid)

                guild['can_manage'] = can_manage
                guild['has_bot'] = has_bot
                guild['last_bump_time'] = meta.get('last_bump_time', 0)
                guild['next_bump_time'] = meta.get('next_bump_time', 0)
                guild['description'] = meta.get('description', '')
                guild['tags'] = meta.get('tags', [])
                processed_guilds.append(guild)

        processed_guilds.sort(key=lambda x: x.get('last_bump_time', 0), reverse=True)
        return jsonify(processed_guilds), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/server/bump', methods=['POST'])
def trigger_bump():
    """触发 Bump 动作并更新 last_bump_time 与 next_bump_time 到数据库"""
    data = request.get_json()
    guild_id = data.get('guild_id')
    if not guild_id:
        return jsonify({'error': 'Guild ID is required'}), 400

    now_ms = int(time.time() * 1000)
    cooldown_ms = 2 * 60 * 60 * 1000  # 2小时冷却
    next_bump_time = now_ms + cooldown_ms

    # 持久化更新到 DB
    DB.save_guild_meta(guild_id, {
        "last_bump_time": now_ms,
        "next_bump_time": next_bump_time
    })

    return jsonify({
        "status": "success",
        "guild_id": guild_id,
        "last_bump_time": now_ms,
        "next_bump_time": next_bump_time
    }), 200

@app.route('/api/servers/recently-bumped', methods=['GET'])
def get_recently_bumped():
    try:
        limit = int(request.args.get('limit', 6))
        servers = DB.get_recently_bumped_guilds(limit=limit)
        return jsonify({
            "status": "success",
            "data": servers
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers', methods=['GET'])
def get_all_servers():
    """全站服务器查询接口：支持分页、排序、搜索与 NSFW 过滤"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 12))
        sort_by = request.args.get('sort', 'bumped')
        allow_nsfw = request.args.get('nsfw', '0') == '1'
        query = request.args.get('q', '').strip().lower()

        # 1. 从 DB 读取公开服务器
        all_guilds = list(DB._guilds.values())
        filtered = [g for g in all_guilds if g.get('is_public', True)]

        # 2. NSFW 过滤
        if not allow_nsfw:
            filtered = [g for g in filtered if not g.get('is_nsfw', False)]

        # 3. 搜索关键词匹配 (匹配名称或标签)
        if query:
            filtered = [
                g for g in filtered
                if query in g.get('name', '').lower() or any(query in tag.lower() for tag in g.get('tags', []))
            ]

        # 4. 动态排序 (bumped / newest / members)
        if sort_by == 'members':
            filtered.sort(key=lambda x: x.get('onlineCount', 0), reverse=True)
        elif sort_by == 'newest':
            filtered.sort(key=lambda x: x.get('id', 0), reverse=True)
        else: # 默认 bumped 倒序
            filtered.sort(key=lambda x: x.get('last_bump_time', 0), reverse=True)

        # 5. 分页计算
        total = len(filtered)
        start = (page - 1) * limit
        end = start + limit
        paginated_list = filtered[start:end]

        return jsonify({
            "status": "success",
            "total": total,
            "page": page,
            "limit": limit,
            "list": paginated_list
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)