from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ================= Mock 数据定义 =================
MOCK_USER_DATA = {
    "id": "763661085374545930",
    "username": "unwelcome_man",
    "global_name": "Ethan",
    "email": "hsyhsy1@hotmail.com",
    "avatar": "a_mock_avatar_hash"  # 可以替换为您真实的头像 hash，为 None 则显示默认头像
}

MOCK_GUILDS_DATA = [
    {"id": "325477692906536972", "name": "Vue Land", "owner": False, "can_manage": False},
    {"id": "662267976984297473", "name": "Midjourney", "owner": False, "can_manage": False},
    {"id": "742088369458118778", "name": "漫画愛好者", "owner": False, "can_manage": False},
    {"id": "793744179066699787", "name": "LinguaLounge", "owner": False, "can_manage": False},
    {"id": "827394560673579048", "name": "Manga Reader", "owner": False, "can_manage": False},
    {"id": "846624424199061524", "name": "Codewars", "owner": False, "can_manage": False},
    {"id": "926196860778066050", "name": "Learn Italian English and German Community", "owner": False, "can_manage": True},
    {"id": "929028745602408609", "name": "Omnilague 3rd Anniversary", "owner": False, "can_manage": False},
    {"id": "983754464395690084", "name": "Romance Langs Learning & Chatting", "owner": False, "can_manage": False},
    {"id": "1017943945214435438", "name": "niji・journey", "owner": False, "can_manage": False},
    {"id": "1046979304547954728", "name": "LimeWire", "owner": False, "can_manage": False},
    {"id": "1127667733027356792", "name": "Programming World 2.0", "owner": False, "can_manage": False},
    {"id": "1128927836623884328", "name": "TEAM ONLY Devs4Devs", "owner": False, "can_manage": False},
    {"id": "1130208835668279419", "name": "Devs For Devs", "owner": False, "can_manage": True},
    {"id": "1325156437223149669", "name": "Hyper Elite Rich Club", "owner": False, "can_manage": False},
    {"id": "1337737502483546144", "name": "‧₊˚ 🎀 Funny's Pony Lounge🐾 ˚₊‧", "owner": False, "can_manage": False},
    {"id": "1465243680754634939", "name": "Test server", "owner": False, "can_manage": True},
    {"id": "1530143678260052098", "name": "Starry sky", "owner": True, "can_manage": True}
]


@app.route('/api/auth/discord', methods=['POST'])
def discord_auth():
    data = request.get_json() or {}
    code = data.get('code')

    print(f"收到前端测试请求 code: {code}")

    # 打印 Mock 控制台日志
    print("\n==================== 👤 用户详细信息 (MOCK) ====================")
    print(f"用户 ID:     {MOCK_USER_DATA['id']}")
    print(f"用户名:      {MOCK_USER_DATA['username']}")
    print(f"显示名称:    {MOCK_USER_DATA['global_name']}")
    print(f"邮箱地址:    {MOCK_USER_DATA['email']}")

    print("\n==================== 🏰 服务器权限分析 (MOCK) ====================")
    for guild in MOCK_GUILDS_DATA:
        status_str = "✅ 有权添加 Bot" if guild['can_manage'] else "❌ 权限不足"
        role_str = "群主" if guild.get('owner') else "管理员/成员"
        print(f"- [{status_str}] 服务器: {guild['name']} | 身份: {role_str} | ID: {guild['id']}")
    print("=========================================================\n")

    # 直接返回模拟数据给前端，不用真正去连 Discord
    return jsonify({
        "message": "登录成功(MOCK模式)",
        "token": "mock_access_token_123456789",
        "user": MOCK_USER_DATA,
        "guilds": MOCK_GUILDS_DATA
    }), 200


if __name__ == '__main__':
    print("🚀 后端 Mock 服务已启动 (已跳过真实 Discord 交互)")
    app.run(port=5000, debug=True)