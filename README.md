# Gproxy

<div align="center">
  <h3>🚀 终极 Gemini API 代理解决方案</h3>
  <p>兼容 OpenAI 格式，配备预设管理、正则处理和密钥管理等高级功能</p>
</div>

## ✨ 功能特性

- 🔄 **OpenAI 格式兼容** - 无缝兼容 OpenAI API 格式，轻松迁移现有应用
- 🎨 **智能预设管理** - 动态注入系统提示词，支持变量替换 ({{roll}}, {{random}})
- 🔧 **正则表达式处理** - 请求前/响应后的高级文本处理规则
- 🔐 **密钥管理系统** - 支持官方密钥和专属密钥，自动轮换和状态监控
- 📊 **实时日志监控** - 详细的请求日志，包含延迟、令牌使用等统计
- 👥 **多用户支持** - 完整的用户认证和权限管理系统
- 🎯 **流式响应支持** - 完整支持 SSE 流式输出
- 🌐 **现代化 Web 界面** - React + TypeScript 构建的精美管理后台

## 🚀 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- SQLite (默认) 或其他数据库

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/foamcold/gproxy.git
cd gproxy
```

2. **后端设置**

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 配置环境变量 (可选)
cp .env.example .env
# 编辑 .env 文件配置你的设置
```

3. **前端设置**

```bash
npm install
```

4. **启动应用**

```bash
# 启动后端 (默认端口 8000)
uvicorn app.main:app --reload

# 新终端:启动前端 (默认端口 5173)
npm run dev
```

5. **访问应用**

- 前端界面: `http://localhost:5173`
- API 端点: `http://localhost:8000/v1/chat/completions`
- API 文档: `http://localhost:8000/docs`

### 默认管理员账户

- 用户名: `admin`
- 密码: `admin`

**⚠️ 首次登录后请立即修改默认密码！**

## 📖 使用说明

### 基本使用

与 OpenAI API 完全兼容，只需替换 base_url 和 API 密钥:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your-exclusive-key"  # 在管理后台生成
)

response = client.chat.completions.create(
    model="gemini-1.5-flash",
    messages=[
        {"role": "user", "content": "你好！"}
    ]
)

print(response.choices[0].message.content)
```

### 预设管理

在管理后台创建预设以自动注入系统提示词:

```json
[
  {
    "role": "system",
    "content": "你是一个专业的助手。今天的日期是 {{date}}。"
  }
]
```

支持的变量:
- `{{date}}` - 当前日期
- `{{time}}` - 当前时间
- `{{random}}` - 随机数
- `{{roll:<sides>}}` - 掷骰子 (例: {{roll:6}})

### 正则规则

创建正则规则进行文本处理:

- **预处理** (请求) - 在发送到 Gemini 前处理用户输入
- **后处理** (响应) - 在返回给客户端前处理 AI 响应

示例: 过滤敏感词

```
模式: \b(敏感词1|敏感词2)\b
替换: ***
```

### 密钥管理

- **专属密钥**: 为用户生成的访问密钥，用于身份验证
- **官方密钥**: Gemini API 密钥，用于实际调用 API

系统自动在多个官方密钥间轮换，确保高可用性。

## 🛠️ 配置

主要配置项在 `app/core/config.py`:

```python
PROJECT_NAME = "Gproxy"
API_V1_STR = "/api/v1"
SECRET_KEY = "your-secret-key"  # 修改为安全的密钥!
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 8  # 8 天
DATABASE_URL = "sqlite+aiosqlite:///./sql_app.db"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com"
```

可通过环境变量或 `.env` 文件覆盖这些设置。

## 🏗️ 项目结构

```
gproxy/
├── app/                    # 后端应用
│   ├── api/               # API 路由
│   │   └── endpoints/     # 端点处理器
│   ├── core/              # 核心配置
│   ├── models/            # 数据库模型
│   ├── schemas/           # Pydantic schemas
│   └── services/          # 业务逻辑
├── src/                   # 前端源码
│   ├── pages/            # 页面组件
│   └── components/       # UI 组件
├── requirements.txt       # Python 依赖
└── README.md             # 本文件
```

## 🔧 开发

### 后端开发

```bash
# 安装开发依赖
pip install -r requirements.txt

# 运行开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端开发

```bash
npm install
npm run dev
```

### 代码规范

- 后端: 遵循 PEP 8 规范
- 前端: 使用 ESLint 和 Prettier

## 📝 API 文档

完整的 API 文档可在运行应用后访问:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 主要端点

- `POST /v1/chat/completions` - 聊天完成 (OpenAI 兼容)
- `GET /v1/models` - 列出可用模型
- `POST /api/v1/auth/login/access-token` - 用户登录
- `GET /api/v1/presets/` - 获取预设列表
- `POST /api/v1/keys/exclusive` - 生成专属密钥

## 🤝 贡献

欢迎贡献！请随时提交 Issue 或 Pull Request。

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Google Gemini](https://ai.google.dev/) - 强大的 AI 模型
- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Python Web 框架
- [React](https://react.dev/) - UI 库

## 📮 联系方式

- GitHub Issues: [提交问题](https://github.com/foamcold/gproxy/issues)

---

<div align="center">
  Made with ❤️ by Your Name
</div>
