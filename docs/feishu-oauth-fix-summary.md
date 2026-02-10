# 飞书 OAuth 登录修复总结

## 问题根源

经过详细分析，发现飞书OAuth登录存在以下核心问题：

### 1. 授权流程不匹配
- **前端**: 使用标准 OIDC 授权流程（`response_type=code`）
- **后端**: 错误使用套件授权流程
- **结果**: 两者不兼容，导致授权失败

### 2. 参数名称错误
- **前端 goto**: 使用 `client_id` 参数（旧版 OAuth）
- **正确参数**: 应使用 `app_id` 参数（飞书专用）

### 3. API 端点混乱
- 前端使用: `https://passport.feishu.cn/suite/passport/oauth/authorize`（旧版）
- 正确端点: `https://open.feishu.cn/open-apis/authen/v1/authorize`（新版）

---

## 修复内容

### 修复 1: 前端 goto 端点

**文件**: `src/app/feishu-oauth/page.tsx`

**修改前**:
```typescript
const goto = `https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
```

**修改后**:
```typescript
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=&state=${state}`;
```

**关键变更**:
- 端点从 `passport.feishu.cn` 改为 `open.feishu.cn`
- 参数从 `client_id` 改为 `app_id`
- 移除 `response_type=code`（新版不需要）

### 修复 2: 消息监听器内存泄漏

**文件**: `src/app/feishu-oauth/page.tsx`

**修改前**:
```typescript
const handleMessage = (event: MessageEvent) => { /* ... */ };
window.addEventListener('message', handleMessage);
// ❌ 没有保存引用，无法移除
```

**修改后**:
```typescript
const handleMessage = (event: MessageEvent) => { /* ... */ };
handleMessageRef.current = handleMessage;
window.addEventListener('message', handleMessage);
// ✅ 保存引用，方便移除
```

**影响**: 避免每次生成二维码都添加新监听器，防止内存泄漏

### 修复 3: 后端授权流程

**文件**: `src/app/api/feishu/oauth/token/route.ts`

**完整流程**:
```typescript
// 步骤 1: 获取 app_access_token
const appTokenResponse = await fetch(
  'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
  {
    method: 'POST',
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  }
);

// 步骤 2: 使用授权码换取 user_access_token
const response = await fetch(
  'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
  {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: FEISHU_APP_ID,
      client_secret: FEISHU_APP_SECRET,
      code: code,
    }),
  }
);
```

**关键点**:
- 必须先获取 `app_access_token`（应用凭证）
- 然后使用 OIDC 端点换取 `user_access_token`
- OIDC 端点需要 `client_id` 和 `client_secret` 参数

---

## 完整的 OAuth 流程

### 1. 用户访问登录页面
```
GET /feishu-oauth
```

### 2. 用户点击"扫码登录"
```
前端加载 SDK → 生成二维码 → 等待用户扫码
```

### 3. 用户扫码确认
```
飞书 App 扫码 → 确认授权 → 飞书服务器自动跳转
```

### 4. 飞书回调
```
GET /feishu-oauth-callback?code=xxx&state=xxx
```

### 5. 回调页面处理
```typescript
// 保存授权码到 localStorage
localStorage.setItem('feishu-oauth-code', code);

// 跳转回登录页面
router.push('/feishu-oauth?code_received=true');
```

### 6. 登录页面处理
```typescript
// 从 localStorage 获取授权码
const code = localStorage.getItem('feishu-oauth-code');

// 调用后端 API
fetch('/api/feishu/oauth/token', {
  method: 'POST',
  body: JSON.stringify({ code, state }),
});
```

### 7. 后端处理
```typescript
// 1. 获取 app_access_token
// 2. 使用授权码换取 user_access_token
// 3. 返回用户令牌
```

### 8. 前端保存令牌
```typescript
// 保存到 localStorage
localStorage.setItem('feishu-user-token', data.access_token);

// 获取用户信息
fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
  headers: { 'Authorization': `Bearer ${data.access_token}` },
});
```

---

## 配置检查

### 飞书开放平台配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 应用 ID | `cli_a90ff12d93635bc4` | 唯一标识 |
| 应用 Secret | `n2rCClUbnOVZoOMMsBDyxfGwtZd1oFO5` | 应用密钥 |
| 重定向 URI | `https://kdck9rbnvr.coze.site/feishu-oauth-callback` | 回调地址 |
| 权限 | `contact:user.base:readonly`<br>`contact:user.email:readonly`<br>`bitable:app:readonly` | 必需权限 |

### 前端配置

| 配置项 | 值 | 文件位置 |
|--------|-----|----------|
| App ID | `cli_a90ff12d93635bc4` | `src/app/feishu-oauth/page.tsx` |
| SDK URL | `https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js` | 动态加载 |
| 授权端点 | `https://open.feishu.cn/open-apis/authen/v1/authorize` | `src/app/feishu-oauth/page.tsx` |

### 后端配置

| 配置项 | 值 | 文件位置 |
|--------|-----|----------|
| App ID | `cli_a90ff12d93635bc4` | `src/app/api/feishu/oauth/token/route.ts` |
| App Secret | `n2rCClUbnOVZoOMMsBDyxfGwtZd1oFO5` | `src/app/api/feishu/oauth/token/route.ts` |
| App Token 端点 | `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal` | `src/app/api/feishu/oauth/token/route.ts` |
| User Token 端点 | `https://open.feishu.cn/open-apis/authen/v1/oidc/access_token` | `src/app/api/feishu/oauth/token/route.ts` |

---

## 测试步骤

### 1. 清除测试数据
```javascript
// 在浏览器控制台执行
localStorage.clear();
```

### 2. 访问登录页面
```
https://kdck9rbnvr.coze.site/feishu-oauth
```

### 3. 执行登录流程
1. 点击"扫码登录"按钮
2. 使用飞书 App 扫描二维码
3. 确认授权

### 4. 验证登录成功
- [ ] 页面显示用户信息（姓名、头像）
- [ ] 状态显示"已登录"
- [ ] localStorage 中存在 `feishu-user-token`

### 5. 测试多维表访问
1. 点击"我的多维表"按钮
2. 查看是否能正常加载多维表列表

### 6. 查看日志
```bash
# 查看后端日志
tail -n 50 /app/work/logs/bypass/feishu-oauth.log
```

---

## 常见错误

### 错误 1: "获取访问令牌失败" (错误代码 99991668)

**原因**: 授权码无效或已过期

**解决**:
- 重新扫码登录
- 检查授权流程是否正确

### 错误 2: "app_access_token 无效" (错误代码 20014)

**原因**: App ID 或 App Secret 错误

**解决**:
- 检查应用配置是否正确
- 确认应用是否启用"扫码登录"功能

### 错误 3: "未收到授权码"

**原因**: 回调页面未正确跳转

**解决**:
- 检查重定向 URI 配置
- 查看浏览器控制台错误信息

---

## 调试指南

### 启用调试模式

1. 打开登录页面
2. 点击"显示调试信息"
3. 查看完整的登录流程日志

### 检查日志

**后端日志**:
```bash
tail -n 100 /app/work/logs/bypass/feishu-oauth.log
```

**前端日志**:
- 打开浏览器开发者工具
- 查看 Console 面板
- 搜索 "[飞书登录]" 关键字

### 诊断工具

访问诊断页面:
```
https://kdck9rbnvr.coze.site/feishu-oauth-diagnostic
```

诊断项目:
- [ ] 配置检查
- [ ] API 端点测试
- [ ] 权限验证

---

## 相关文档

- [飞书 OAuth 官方文档](https://open.feishu.cn/document/server-docs/authentication-management/access-token/access-token)
- [飞书二维码 SDK 文档](https://open.feishu.cn/document/sso/web-application-sso/qr-sdk-documentation)
- [项目 OAuth 分析文档](./feishu-oauth-analysis.md)
