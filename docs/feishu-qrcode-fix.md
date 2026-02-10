# 飞书二维码显示问题修复

## 问题描述

用户反馈：二维码显示不存在（容器为空，没有渲染二维码）

## 问题分析

经过排查，发现以下问题：

### 1. goto URL 参数问题
- **问题**: `scope=` 参数为空
- **影响**: 可能导致授权 URL 格式错误

### 2. 容器高度问题
- **问题**: 容器没有设置最小高度
- **影响**: SDK 可能无法在零高度容器中渲染

### 3. style 参数冲突
- **问题**: QRLogin 的 style 参数与 SDK 内部样式冲突
- **影响**: 二维码可能无法正确显示

### 4. state 参数问题
- **问题**: goto URL 中手动添加了 state 参数
- **影响**: 与 SDK 自动生成的 state 冲突
- **正确做法**: state 由 QRLogin SDK 自动生成和传递

### 5. 实例未销毁
- **问题**: 重复点击"扫码登录"时，之前的实例未销毁
- **影响**: 可能导致容器状态混乱

## 修复内容

### 修复 1: 移除空的 scope 参数

**修改前**:
```typescript
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=&state=${state}`;
```

**修改后**:
```typescript
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
```

### 修复 2: 添加容器最小高度

**修改前**:
```typescript
<div id="feishu_qr_container" ref={qrCodeRef}></div>
```

**修改后**:
```typescript
<div
  id="feishu_qr_container"
  ref={qrCodeRef}
  style={{ minWidth: '400px', minHeight: '400px' }}
></div>
```

### 修复 3: 移除 style 参数

**修改前**:
```typescript
const QRLoginObj = window.QRLogin({
  id: 'feishu_qr_container',
  goto: goto,
  width: '500',
  height: '500',
  style: 'width:500px;height:600px',
});
```

**修改后**:
```typescript
const QRLoginObj = window.QRLogin({
  id: 'feishu_qr_container',
  goto: goto,
  width: '400',
  height: '400',
});
```

### 修复 4: 移除 state 参数

**修改前**:
```typescript
const state = Date.now().toString();
const redirectUri = `${origin || window.location.origin}/feishu-oauth-callback`;
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
```

**修改后**:
```typescript
const currentOrigin = origin || window.location.origin;
const redirectUri = `${currentOrigin}/feishu-oauth-callback`;
const goto = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
```

**说明**: state 参数由 QRLogin SDK 自动生成，无需手动添加

### 修复 5: 添加实例销毁逻辑

**修改前**:
```typescript
container.innerHTML = '';
```

**修改后**:
```typescript
// 销毁之前的 QRLogin 实例（如果存在）
if (qrLoginObjRef.current && typeof qrLoginObjRef.current.destroy === 'function') {
  addDebugInfo('销毁之前的 QRLogin 实例');
  qrLoginObjRef.current.destroy();
  qrLoginObjRef.current = null;
}

// 清空容器
container.innerHTML = '';
```

## 正确的配置

### QRLogin SDK 配置

```javascript
const QRLoginObj = QRLogin({
  id: 'feishu_qr_container',    // 容器 ID
  goto: 'https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={app_id}&redirect_uri={redirect_uri}',
  width: '400',                   // 二维码宽度
  height: '400',                  // 二维码高度
});
```

### goto URL 格式

```
https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={app_id}&redirect_uri={redirect_uri}
```

**注意**:
- ✅ 不需要 `state` 参数（SDK 自动生成）
- ✅ 不需要 `scope` 参数（可选）
- ✅ 不需要 `response_type` 参数（默认使用 code）
- ✅ 不需要 `client_id` 参数（使用 `app_id`）

### 容器要求

```html
<div
  id="feishu_qr_container"
  style="min-width: 400px; min-height: 400px;"
></div>
```

**注意**:
- ✅ 必须设置最小宽高
- ✅ 容器 ID 必须与 QRLogin 配置的 id 一致
- ✅ 容器应该是空的或只包含 QRLogin SDK 生成的内容

## 测试步骤

1. 访问 `/feishu-oauth` 页面
2. 打开浏览器控制台
3. 点击"扫码登录"按钮
4. 查看控制台日志
5. 检查二维码是否正常显示

### 预期日志

```
[飞书登录 XX:XX:XX] showQrCode 函数被调用
[飞书登录 XX:XX:XX] generateQrCode 函数开始执行
[飞书登录 XX:XX:XX] ✅ 找到二维码容器
[飞书登录 XX:XX:XX] App ID: cli_a90ff12d93635bc4
[飞书登录 XX:XX:XX] Origin: https://kdck9rbnvr.coze.site
[飞书登录 XX:XX:XX] Redirect URI: https://kdck9rbnvr.coze.site/feishu-oauth-callback
[飞书登录 XX:XX:XX] Goto URL: https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=cli_a90ff12d93635bc4&redirect_uri=https%3A%2F%2Fkdck9rbnvr.coze.site%2Ffeishu-oauth-callback
[飞书登录 XX:XX:XX] 开始调用 window.QRLogin...
[飞书登录 XX:XX:XX] ✅ window.QRLogin 调用完成
[飞书登录 XX:XX:XX] 容器当前子元素数: X
[飞书登录 XX:XX:XX] 2秒后容器子元素数: X
[飞书登录 XX:XX:XX] ✅ 二维码已生成
[飞书登录 XX:XX:XX] ✅ 二维码生成完成，等待用户扫码...
```

### 预期结果

- ✅ 二维码容器显示二维码
- ✅ 二维码可扫描
- ✅ 扫码后能正常跳转

## 常见错误

### 错误 1: 二维码容器为空

**可能原因**:
- goto URL 格式错误
- SDK 未正确加载
- 容器 ID 不匹配
- 容器高度为 0

**解决方法**:
- 检查 goto URL 格式
- 确认 SDK 已加载（`window.QRLogin` 存在）
- 确认容器 ID 正确
- 添加容器最小高度

### 错误 2: 二维码显示但无法扫描

**可能原因**:
- goto URL 参数错误
- 重定向 URI 未配置
- App ID 错误

**解决方法**:
- 检查 goto URL 参数
- 确认飞书开放平台配置了重定向 URI
- 确认 App ID 正确

### 错误 3: 重复点击"扫码登录"时二维码不更新

**可能原因**:
- 之前的实例未销毁

**解决方法**:
- 在生成新二维码前销毁旧实例
- 调用 `qrLoginObj.destroy()`

## 参考文档

- [飞书二维码 SDK 文档](https://open.feishu.cn/document/sso/web-application-sso/qr-sdk-documentation)
- [飞书 OAuth 授权文档](https://open.feishu.cn/document/server-docs/authentication-management/access-token/access-token)
