# Git 协作流程与常用命令（新手版）

## 1. `feature/*` 到底是什么意思

- `feature/*` 是命名模式，不是固定分支名。
- 这里的 `*` 表示“你自己填写的具体需求名”。
- 例如：
  - `feature/fix-matrix-task-count`
  - `feature/employee-view-refresh`
  - `feature/drag-unassigned-panel`

一句话理解：
- `feature/*` = `feature/你的分支名`

---

## 2. 推荐分支命名

- 新功能：`feature/xxx`
- 修复问题：`fix/xxx`
- 紧急修复：`hotfix/xxx`
- 重构：`refactor/xxx`

建议：
- 全小写
- 用 `-` 分隔单词
- 名字尽量能看懂这次改了什么

---

## 3. 标准协作流程（团队推荐）

1. 从 `main` 拉最新代码
2. 新建自己的功能分支
3. 在功能分支开发并提交
4. 推送到远端
5. 发起 PR 到 `main`
6. 在 Vercel Preview 验收
7. Review 通过后合并到 `main`
8. Vercel 自动部署生产

---

## 4. 最常用命令（每行带注释）

```bash
# 进入项目目录
cd d:\manager_vb\projects

# 切到主分支
git checkout main

# 拉取远端主分支最新代码
git pull origin main

# 新建并切换到功能分支（把 xxx 改成你的任务名）
git checkout -b feature/xxx

# 查看当前分支
git branch --show-current

# 查看当前改动状态
git status

# 暂存所有改动
git add .

# 只暂存某一个文件（示例）
git add src/app/view/page.tsx

# 提交（写清楚这次改动）
git commit -m "fix: 修复员工页矩阵任务统计口径"

# 第一次推送这个分支，并建立跟踪关系
git push -u origin feature/xxx

# 后续继续推送（同一分支）
git push
```

---

## 5. PR（Pull Request）相关

### PR 是什么

- PR = 请求把你的分支合并进 `main`。
- 用于代码审核、预览验收、风险控制。

### 发起 PR 后如何预览

- 在 GitHub 的 PR 页面找到 `Vercel` 检查项
- 点击 `Details`
- 打开 Preview 链接
- 员工页路径：在预览域名后加 `/view`
  - 例如：`https://xxx.vercel.app/view`

---

## 6. 常见问题

### Q1：每次提交都要新建 PR 吗？

- 不需要。
- 一个分支通常对应一个 PR。
- 你继续往这个分支 `git push`，PR 会自动更新。

### Q2：为什么显示 “There isn’t anything to compare”？

- 说明 `main` 和你的分支没有差异（内容一样）。
- 常见原因：你从最新 `main` 切分支后还没在分支上产生新提交。

### Q3：什么时候可以不走 PR？

- 个人临时项目可以直接推 `main`。
- 团队协作、线上项目强烈建议走 PR。

---

## 7. 一套最省事的日常模板

```bash
git checkout main
git pull origin main
git checkout -b feature/xxx

# 开发...
git add .
git commit -m "fix: xxx"
git push -u origin feature/xxx

# 然后去 GitHub 开 PR -> 看 Preview -> Review -> Merge
```

