# 如何获取语雀 Token（`_yuque_session`）

下载**私有知识库**或「账号全部」时，需要配置语雀登录 Cookie：`_yuque_session`。  
**公开库**一般不需要；公开库若设了阅读密码，用下载表单里的「访问密码」，不是这个 Token。

> 以 Chrome 为例，其他浏览器类似。

## 步骤

1. 浏览器登录 [语雀](https://www.yuque.com)
2. 右键 →「检查」，或按 `F12`（Mac：`Option + Command + J`）
3. 打开 **Application**（应用程序）面板  
4. 左侧 **Cookies** → `https://www.yuque.com`  
5. 在列表中找到 Name 为 **`_yuque_session`** 的项，双击 **Value** 列并复制

![getoken](https://github.com/gxr404/yuque-dl/assets/17134256/cd28331a-5618-4c15-90de-6b914a0dd375)

## 填到哪里

| 位置 | 用途 |
|------|------|
| **设置页 → Token 设置** | 持久保存，全站私有下载回落使用；可「检测」有效性 |
| **下载页 → 下载默认配置** | 可临时用于本次下载，或点「保存设置」写入后端 |

企业版 Cookie 名若不是 `_yuque_session`，在设置页改 **Cookie Key**。

## 注意

- Cookie 是个人登录态，**请勿泄露**给他人或提交到公开仓库
- 与「接口页 API Token」「公开库阅读密码」不是同一种东西
