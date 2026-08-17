# 2026-06-09 杂项修复与一键启动

## 1. 一键启动/停止脚本

**问题**: 每次启动需要手动输入 JAVA_HOME + Maven 完整路径，过程繁琐。

**方案**:
- `start.bat` — Windows 双击启动，纯 ASCII 保证编码兼容（CRLF 换行，无中文防 GBK 乱码）
- `start.sh` — bash 终端 `./start.sh`
- `stop.bat` — 一键停止 8080/5173 端口进程

**踩坑**: start.bat 最初含中文导致 cmd.exe GBK 解析乱码 → 改为纯 ASCII。LF 换行导致 cmd 把整文件当一行解析 → sed 转 CRLF。

## 2. HeapStack 审查修复

**来源**: `reviews/heapstack-review.md` 三条 Low 级清理项。

| # | 文件 | 修复 |
|---|------|------|
| 1 | HeapStackPanel.vue | 删除重复的第二个 `<style scoped>` 块（原 L289-427） |
| 2 | HeapStackPanel.vue | 删除未使用的 `frameMethod` computed |
| 3 | TraceEngine.java | 删除重复的 `else if (!existed)` 块 + 修复合并冲突残留注释 |

RunController 硬编码 TRACE_ENGINE_SOURCE 已确认无此重复问题，无需同步。

## 3. 错误信息精准化

**问题**: `extractClassName()` 把 JavaParser 的所有解析失败都报 "缺少 public class 声明"，缺分号也报这个。

**修复**: 先用正则检测是否真有 `public class Xxx` 声明：
- 有 → "代码语法错误：(line X,col Y) Found ..."（精简掉 expected 列表和堆栈）
- 无 → 保留原 "缺少 public class 声明" 提示

## 4. 键盘输入 Bug 根因确认

**结论**: 第三方输入法 Rime（小狼毫）英文模式与 Monaco Editor 冲突，非代码 bug。

**排查过程**: 尝试了 `automaticLayout: true/false`、移除 `direction: ltr`、`lineNumbers: 'off'` 等方案均无效。组员相同代码无此问题。最终确认根因：Rime 英文模式下仍 hook 键盘事件，干扰 Monaco 内部 textarea。解决方案：使用系统自带输入法。
