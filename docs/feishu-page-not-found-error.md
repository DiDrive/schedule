# 飞书扫码登录"页面不存在"错误分析与解决方案

## 问题现象

扫码后飞书显示错误页面：
```
抱歉，您访问的页面不存在
```

## 问题分析

从截图分析，二维码确实生成了，用户也成功扫描了二维码。但是当飞书尝试访问授权 URL 时，返回了"页面不存在"错误。

这说明授权请求被飞书服务器拒绝了。

## 根本原因

**redirect_uri 未在飞书开放平台配置中**

飞书 OAuth 2.0 要求：
1. 所有 redirect_uri 必须在飞书开放平台的应用配置中预先设置
2. redirect_uri 必须与请求中使用的完全匹配（包括协议、域名、路径）

当前配置：
- App ID: `cli_a90ff12d93635bc4`
- Redirect URI: `https://kdck9rbnvr.coze.site/feishu-oauth-callback`

如果这个 URI 没有在飞书开放平台配置，飞书会拒绝授权请求。

## 代码修复

### 1. 添加 state 参数到授权 URL

**问题**: 之前的代码生成了 state，但没有添加到授权 URL 中。

**修复**:
```typescript
// 修复前
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

// 修复后
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
```

### 2. 使用 stateRef 保存 state

```typescript
const stateRef = useRef<string>('');

// 在生成二维码时
const state = crypto.randomUUID();
stateRef.current = state;

// 在交换令牌时
exchangeCodeForToken(event.data.code, stateRef.current);
```

## 解决方案

### 步骤 1: 配置飞书应用（必须）

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 进入应用管理页面
3. 找到应用 ID: `cli_a90ff12d93635bc4`
4. 进入"安全设置"或"重定向 URI"配置页面
5. 添加以下重定向 URI：
   - `https://kdck9rbnvr.coze.site/feishu-oauth-callback`
   - `http://localhost:5000/feishu-oauth-callback` (开发环境)
6. 保存配置

### 步骤 2: 确认应用权限

确保应用具有以下权限：
- `contact:user.base:readonly` - 获取用户基本信息
- `contact:user.email:readonly` - 获取用户邮箱（可选）
- `contact:user.mobile:readonly` - 获取用户手机号（可选）

### 步骤 3: 确认应用已发布

- 应用状态必须为"已发布"或"已启用"
- 如果是测试应用，需要确保测试账号列表包含你的飞书账号

## 验证步骤

1. 访问 `https://kdck9rbnvr.coze.site/feishu-oauth`
2. 点击"扫码登录"按钮
3. 使用飞书 App 扫描二维码
4. 确认授权

**预期结果**:
- ✅ 二维码正常显示
- ✅ 扫码后显示飞书授权页面（而不是"页面不存在"）
- ✅ 授权成功后跳转到回调页面
- ✅ 获取访问令牌和用户信息

## 常见问题

### Q1: 配置了 redirect_uri 还是报错？

**A**: 检查以下几点：
1. redirect_uri 是否完全匹配（包括协议 http/https）
2. 应用是否已发布
3. 应用权限是否正确配置
4. 你的飞书账号是否在测试账号列表中（如果是测试应用）

### Q2: 开发环境如何配置？

**A**: 开发环境使用 `http://localhost:5000`，需要在飞书配置中添加：
- `http://localhost:5000/feishu-oauth-callback`

### Q3: 可以使用其他 redirect_uri 吗？

**A**: 可以，但必须：
1. 在飞书配置中预先设置
2. 与代码中使用的完全一致
3. 使用 http 或 https 协议

### Q4: state 参数是必须的吗？

**A**: 虽然 state 不是飞书强制要求的参数，但它是 OAuth 2.0 的安全最佳实践，用于防止 CSRF 攻击。建议始终包含。

## 调试技巧

### 1. 查看调试信息

页面底部有"调试信息"面板，点击可以看到：
- App ID
- Origin
- Redirect URI
- State
- Goto URL

### 2. 检查 goto URL

确保 goto URL 格式正确：
```
https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=cli_a90ff12d93635bc4&redirect_uri=https%3A%2F%2Fkdck9rbnvr.coze.site%2Ffeishu-oauth-callback&state=xxx
```

### 3. 手动访问 goto URL

在浏览器中直接访问 goto URL，如果跳转到"页面不存在"，说明配置有问题。

### 4. 查看浏览器控制台

打开浏览器开发者工具（F12），查看：
- Console 标签：查看 JavaScript 错误
- Network 标签：查看网络请求

## 相关文档

- [飞书开放平台 - 网页应用登录](https://open.feishu.cn/document/common-capabilities/sso/web-application/webapp-login-guide)
- [飞书开放平台 - OAuth 2.0](https://open.feishu.cn/document/common-capabilities/sso/api/get-code)
- [飞书开放平台 - 二维码登录](https://open.feishu.cn/document/common-capabilities/sso/api/qr-code-login)

## 总结

"页面不存在"错误的核心原因是 **redirect_uri 未在飞书开放平台配置**。

解决步骤：
1. ✅ 代码修复：添加 state 参数到授权 URL
2. ⏳ 飞书配置：在飞书开放平台添加 redirect_uri
3. ⏳ 验证测试：扫码登录流程

完成飞书配置后，扫码登录应该可以正常工作。
