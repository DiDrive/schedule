# 飞书扫码登录说明

## 问题背景

企业自建应用无法直接访问用户个人创建的多维表，即使有正确的 App Token 和所有权限。

## 解决方案

通过飞书**扫码登录**授权，使用飞书官方二维码 SDK，系统可以使用你的身份访问你的多维表。

## 使用步骤

### 1. 配置 App ID

1. 访问 `http://localhost:5000/feishu-oauth`
2. 点击 **"App ID 配置"** 卡片右上角的设置图标
3. 输入你的飞书应用的 App ID
4. 点击 **"保存配置"**

### 2. 如何获取 App ID

**方法一：从飞书开放平台获取**
1. 访问 https://open.feishu.cn/app
2. 找到或创建一个应用
3. 进入应用详情页
4. 在 **"凭证与基础信息"** 中查看 App ID

**方法二：从现有的配置中获取**
1. 打开飞书集成配置对话框
2. 查看 **"应用配置"** 标签页
3. 复制 App ID 字段的值

### 3. 扫码登录

1. 在飞书扫码登录页面，点击 **"生成扫码登录二维码"** 按钮
2. 页面会显示飞书登录的二维码
3. 使用飞书 App 扫描二维码
4. 在飞书 App 中确认授权
5. 授权成功后，自动登录系统

### 4. 测试访问个人多维表

1. 登录成功后，访问 `http://localhost:5000/feishu-user-token-test`
2. 输入你个人创建的多维表的 App Token 和 Table ID
3. 点击 **"开始测试"**
4. 如果能成功读取到数据，说明登录成功！

## 技术实现

### 飞书官方二维码 SDK

使用飞书官方提供的二维码 SDK：
- **SDK 地址**：https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js
- **文档**：https://open.feishu.cn/document/sso/web-application-sso/qr-sdk-documentation

### 登录流程

1. **加载 SDK**：前端动态加载飞书二维码 SDK
2. **生成二维码**：调用 `QRLogin()` 方法生成二维码
3. **用户扫码**：用户使用飞书 App 扫描二维码
4. **获取临时码**：SDK 返回 `tmp_code`（临时授权码）
5. **跳转授权**：跳转到飞书授权页面（带上 `tmp_code`）
6. **飞书重定向**：飞书重定向到回调地址，带上 `code` 和 `state`
7. **交换令牌**：后端用 `code` 换取 `user_access_token`
8. **获取用户信息**：使用 `user_access_token` 获取用户信息
9. **保存登录状态**：保存到 localStorage

### API 接口

- **授权码交换令牌**：`POST /api/feishu/oauth/token`
  - 参数：`code`（授权码）、`state`（状态码）
  - 返回：`access_token`、`refresh_token`、`expires_in`

- **OAuth 回调**：`GET /feishu-oauth-callback`
  - 参数：`code`（授权码）、`state`（状态码）
  - 功能：接收飞书的重定向，通知主窗口

### 权限范围

系统请求的权限：
- 读取多维表数据

### 令牌管理

- **user_access_token**：用户访问令牌，存储在浏览器 localStorage
- **有效期**：令牌有有效期，过期后需要重新登录
- **安全性**：退出登录时会清除令牌

## 优势

- ✅ **官方 SDK**：使用飞书官方二维码 SDK，更可靠
- ✅ **无需跳转**：在网页内完成授权，体验流畅
- ✅ **安全认证**：使用官方认证流程，安全性高
- ✅ **访问个人数据**：可以访问用户个人创建的多维表
- ✅ **简单易用**：扫码即可登录，无需复杂配置

## 注意事项

1. **App ID 正确性**：确保 App ID 在飞书开放平台中存在且有效
2. **授权码有效期**：授权码有效期 5 分钟，且只能使用一次
3. **令牌有效期**：用户令牌有有效期，过期后需要重新登录
4. **安全性**：令牌存储在浏览器 localStorage 中，请勿在公共设备上使用

## 常见问题

### Q: 为什么需要扫码登录？

A: 企业自建应用只能访问通过它自己创建的多维表，无法直接访问个人多维表。通过扫码登录，系统可以使用你的身份访问你的多维表。

### Q: "app id not exists" 错误怎么办？

A: 这说明 App ID 在飞书开放平台中不存在或已失效。请：
1. 检查 App ID 是否正确
2. 确认该应用在飞书开放平台中是否存在
3. 如果应用已删除，需要重新创建

### Q: 如何创建飞书应用？

A:
1. 访问 https://open.feishu.cn/app
2. 点击 **"创建企业自建应用"**
3. 填写应用名称和描述
4. 创建完成后，在 **"凭证与基础信息"** 中查看 App ID

### Q: 登录后能看到哪些数据？

A: 系统只能看到你有权限访问的多维表和记录。

### Q: 登录后我的数据安全吗？

A: 系统只请求读取多维表的权限，不会修改或删除你的数据。

### Q: 如何退出登录？

A: 在飞书扫码登录页面，点击 **"退出登录"** 按钮即可。

### Q: 扫码后没有反应？

A: 请确保：
1. 已在飞书 App 中打开扫码功能
2. 网络连接正常
3. App ID 配置正确
4. 二维码没有过期（有效期 5 分钟）

### Q: 授权码过期了怎么办？

A: 授权码有效期 5 分钟，过期后重新生成二维码即可。

## 错误处理

### 错误：app id not exists

**原因**：App ID 在飞书开放平台中不存在或已失效

**解决**：
1. 检查 App ID 是否正确
2. 确认应用是否存在
3. 如需要，重新创建应用

### 错误：SDK 加载失败

**解决**：
1. 检查网络连接
2. 刷新页面重试
3. 确保可以访问飞书 CDN

### 错误：授权码无效

**原因**：授权码已过期或已被使用

**解决**：
1. 重新生成二维码
2. 在 5 分钟内完成授权

### 错误：获取访问令牌失败

**解决**：
1. 检查 App ID 和 App Secret 是否正确
2. 确认应用状态正常
3. 检查网络连接

## 相关页面

- 飞书扫码登录页面：`/feishu-oauth`
- OAuth 回调页面：`/feishu-oauth-callback`
- 用户令牌测试页面：`/feishu-user-token-test`
- 飞书集成配置：打开飞书集成对话框

## 开发者参考

### SDK 初始化

```javascript
const QRLoginObj = QRLogin({
  id: 'login_container',
  goto: 'https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&response_type=code&state=STATE',
  width: '500',
  height: '500',
  style: 'width:500px;height:600px'
});
```

### 监听扫码事件

```javascript
const handleMessage = (event) => {
  if (QRLoginObj.matchOrigin(event.origin) && QRLoginObj.matchData(event.data)) {
    const tmpCode = event.data.tmp_code;
    window.location.href = `${goto}&tmp_code=${tmpCode}`;
  }
};
window.addEventListener('message', handleMessage);
```

### 交换授权码

```javascript
const response = await fetch('/api/feishu/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, state }),
});
```

## 技术栈

- **前端 SDK**：LarkSSOSDKWebQRCode-1.0.3.js
- **授权方式**：Authorization Code Flow
- **令牌类型**：User Access Token
- **认证方式**：OAuth 2.0

## 更新日志

- 2024-11-29：使用飞书官方二维码 SDK实现扫码登录
