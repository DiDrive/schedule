# 飞书 OAuth 登录逻辑梳理

## 一、当前架构概览

### 1.1 页面结构

```
/feishu-oauth          ← 登录页面（生成二维码、处理回调）
/feishu-oauth-callback ← 回调页面（接收授权码）
/feishu-oauth-diagnostic ← 诊断页面
```

### 1.2 API 端点

```
POST /api/feishu/oauth/token  ← 使用授权码换取用户令牌
GET  /api/feishu/user/bitable-apps ← 获取多维表列表
```

---

## 二、OAuth 流程分析

### 2.1 前端流程（登录页面）

#### Step 1: 加载飞书 SDK
```typescript
// src/app/feishu-oauth/page.tsx
const script = document.createElement('script');
script.src = 'https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js';
```

#### Step 2: 生成二维码
```typescript
const goto = `https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;

const QRLoginObj = window.QRLogin({
  id: 'feishu_qr_container',
  goto: goto,
  width: '500',
  height: '500',
});
```

**关键参数**：
- `client_id`: `cli_a90ff12d93635bc4`
- `redirect_uri`: `https://kdck9rbnvr.coze.site/feishu-oauth-callback`
- `response_type`: `code`（标准 OAuth 授权码流程）
- `state`: 随机字符串（防 CSRF）

#### Step 3: 监听扫码成功事件
```typescript
const handleMessage = (event: MessageEvent) => {
  if (QRLoginObj.matchOrigin(event.origin) && QRLoginObj.matchData(event.data)) {
    // 备用方案：直接处理授权码
    if (event.data.code) {
      exchangeCodeForToken(event.data.code, state);
    }
  }
};
window.addEventListener('message', handleMessage);
```

#### Step 4: 处理回调
```typescript
// 方式1: 从 URL 参数获取 code_received=true
if (code === 'true') {
  const actualCode = localStorage.getItem('feishu-oauth-code');
  exchangeCodeForToken(actualCode, state);
}

// 方式2: 直接从 URL 获取 code
if (code) {
  exchangeCodeForToken(code, state);
}
```

#### Step 5: 换取令牌
```typescript
const response = await fetch('/api/feishu/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, state }),
});

// 保存令牌
localStorage.setItem('feishu-user-token', data.access_token);
```

### 2.2 回调页面流程

```typescript
// src/app/feishu-oauth-callback/page.tsx
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

if (code) {
  localStorage.setItem('feishu-oauth-code', code);
  localStorage.setItem('feishu-oauth-state', state || '');
  router.push('/feishu-oauth?code_received=true');
}
```

**问题**：回调页面只是保存授权码，然后跳转，没有直接调用 API。

### 2.3 后端 API 流程

```typescript
// src/app/api/feishu/oauth/token/route.ts

// Step 1: 获取 tenant_access_token
const tenantTokenResponse = await fetch(
  'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
  {
    method: 'POST',
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  }
);

// Step 2: 使用授权码换取 user_access_token
const response = await fetch(
  'https://open.feishu.cn/open-apis/authen/v1/access_token',
  {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'authorization_code',
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
      code: code,
    }),
  }
);
```

---

## 三、问题分析

### 问题 1: 流程不匹配

**前端使用**：标准 OAuth 授权码流程
- 授权端点：`https://passport.feishu.cn/suite/passport/oauth/authorize`
- 参数：`response_type=code`

**后端使用**：套件授权流程
- 先获取 tenant_access_token
- 再用 app_access_token 换取 user_access_token

**问题**：这两个流程不匹配！

对于标准 OAuth 授权码流程：
1. 用户扫码授权
2. 飞书回调返回授权码
3. 后端直接用 app_id 和 app_secret 换取 user_access_token
4. **不需要**先获取 tenant_access_token

### 问题 2: 消息监听器泄漏

```typescript
// src/app/feishu-oauth/page.tsx (line 291-313)
const handleMessage = (event: MessageEvent) => { /* ... */ };
window.addEventListener('message', handleMessage);
```

**问题**：
- `handleMessage` 是在 `generateQrCode` 函数内部定义的
- 没有保存到 `handleMessageRef.current`
- cleanup 函数无法移除监听器
- 每次生成二维码都会添加新的监听器，导致内存泄漏

### 问题 3: goto 参数端点错误

当前代码：
```typescript
const goto = `https://passport.feishu.cn/suite/passport/oauth/authorize`;
```

根据飞书文档，正确的端点应该是：
```typescript
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize`;
```

### 问题 4: 后端 API 参数错误

后端使用套件授权参数：
```typescript
{
  grant_type: 'authorization_code',
  app_id: 'xxx',
  app_secret: 'xxx',
  code: 'xxx'
}
```

但标准 OAuth 应该使用：
```typescript
{
  grant_type: 'authorization_code',
  client_id: 'xxx',
  client_secret: 'xxx',
  code: 'xxx'
}
```

---

## 四、正确流程

### 方案 A: 使用标准 OAuth 授权码流程（推荐）

**前端**：
```typescript
// 使用正确的端点
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=&state=${state}`;
```

**后端**：
```typescript
// 直接使用 app_id 和 app_secret
const response = await fetch(
  'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token', // OIDC 端点
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

### 方案 B: 使用套件授权流程（当前使用但不正确）

**前端**：
```typescript
// 使用套件授权端点
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=&state=${state}`;
```

**后端**：
```typescript
// 1. 获取 app_access_token
const appTokenResponse = await fetch(
  'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
  {
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  }
);

// 2. 使用 app_access_token 换取 user_access_token
const response = await fetch(
  'https://open.feishu.cn/open-apis/authen/v1/access_token',
  {
    headers: {
      'Authorization': `Bearer ${app_access_token}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: code,
    }),
  }
);
```

---

## 五、配置检查清单

### 飞书开放平台配置

1. **应用 ID**: `cli_a90ff12d93635bc4`
2. **应用 Secret**: `n2rCClUbnOVZoOMMsBDyxfGwtZd1oFO5`
3. **重定向 URI**: `https://kdck9rbnvr.coze.site/feishu-oauth-callback`
4. **权限**:
   - 获取用户基本信息 (`contact:user.base:readonly`)
   - 获取用户邮箱 (`contact:user.email:readonly`)
   - 读取多维表 (`bitable:app:readonly`)

### 前端配置

- [x] App ID 正确
- [x] 重定向 URI 正确
- [x] SDK 加载
- [x] 消息监听器
- [ ] goto 端点需要修正

### 后端配置

- [x] App ID 正确
- [x] App Secret 正确
- [ ] 授权流程需要修正

---

## 六、修复方案

### 修复 1: 修正前端 goto 端点

```typescript
// src/app/feishu-oauth/page.tsx
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=&state=${state}`;
```

### 修复 2: 修正后端授权流程

```typescript
// src/app/api/feishu/oauth/token/route.ts

// 移除获取 tenant_access_token 的步骤

// 直接使用 app_id 和 app_secret
const response = await fetch(
  'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: FEISHU_APP_ID,
      client_secret: FEISHU_APP_SECRET,
      code: code,
    }),
  }
);
```

### 修复 3: 修复消息监听器泄漏

```typescript
// src/app/feishu-oauth/page.tsx

const handleMessage = (event: MessageEvent) => { /* ... */ };

// 保存引用
handleMessageRef.current = handleMessage;

window.addEventListener('message', handleMessage);

// 在 cleanup 中移除
useEffect(() => {
  return () => {
    if (handleMessageRef.current) {
      window.removeEventListener('message', handleMessageRef.current);
      handleMessageRef.current = null;
    }
  };
}, []);
```

---

## 七、测试步骤

1. 清除 localStorage
2. 访问 `/feishu-oauth`
3. 点击"扫码登录"
4. 使用飞书 App 扫码
5. 确认授权
6. 检查是否成功登录

**调试检查点**：
- [ ] 二维码是否生成
- [ ] 扫码后是否显示"已确认"
- [ ] 是否跳转到回调页面
- [ ] 回调页面是否返回授权码
- [ ] 后端 API 是否成功调用
- [ ] 令牌是否保存到 localStorage
- [ ] 用户信息是否显示
