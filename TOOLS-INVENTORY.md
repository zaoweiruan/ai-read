# Tool Inventory — 当前 Agent 模式全部可用工具

> 生成日期：2026-10-29
> 说明：本文档列出当前会话（Agent 模式）下会随系统提示一并发送给大模型的全量工具，按「内置 + 各启用 MCP」分组。

## 1. 内置工具（Built-in）

| 工具名 | 用途 |
| --- | --- |
| `read` | 读取本地文件/目录 |
| `write` | 写入文件 |
| `edit` | 精确字符串替换编辑 |
| `glob` | 文件模式匹配查找 |
| `grep` | 文件内容正则搜索 |
| `bash` | 执行 PowerShell 命令 |
| `webfetch` | 抓取 URL 内容 |
| `skill` | 加载技能指令 |
| `task` | 启动子代理 |
| `todowrite` | 维护任务清单 |
| `schedule_wakeup` | 安排未来唤醒点 |
| `cancel_wakeup` | 取消已安排唤醒 |
| `cron_create` | 创建周期任务 |
| `cron_delete` | 删除周期任务 |
| `cron_list` | 列出周期任务 |
| `goal` | 启动/恢复会话目标 |
| `goal_report` | 上报目标完成/受阻 |
| `question` | 向用户提问 |
| `link_pr` | 链接会话到 PR |
| `suggest` | 建议本地代码评审 |
| `compress` | 压缩对话以管理上下文 |
| `board_post` | 向共享板发帖 |
| `board_read` | 读取共享板 |
| `kilo_local_recall` | 检索过往会话 |
| `list_mcp_resource_templates` | 列出 MCP 资源模板 |
| `list_mcp_resources` | 列出 MCP 资源 |
| `read_mcp_resource` | 读取 MCP 资源 |

## 2. MCP：agent_manager

| 工具名 | 用途 |
| --- | --- |
| `agent_manager_models` | 查询 Agent Manager 可用模型 |

## 3. MCP：background_process

| 工具名 | 用途 |
| --- | --- |
| `background_process` | 运行/管理长时后台进程 |

## 4. MCP：caura

| 工具名 | 用途 |
| --- | --- |
| `caura_caura_doc` | 结构化文档 CRUD |
| `caura_caura_entity_get` | 按 UUID 查实体 |
| `caura_caura_evolve` | 记录行动结果并演化记忆 |
| `caura_caura_insights` | 记忆库反思 |
| `caura_caura_keystones` | 读取强制规则 |
| `caura_caura_keystones_set` | 设定/删除强制规则 |
| `caura_caura_list` | 按元数据浏览记忆 |
| `caura_caura_manage` | 记忆生命周期管理 |
| `caura_caura_recall` | 语义检索记忆 |
| `caura_caura_stats` | 记忆聚合统计 |
| `caura_caura_tune` | 调整检索默认参数 |
| `caura_peer` | 对等发现/消息/线程 |

## 5. MCP：context7

| 工具名 | 用途 |
| --- | --- |
| `context7_resolve-library-id` | 解析库 ID |
| `context7_query-docs` | 查询库文档 |

## 6. MCP：desktop-commander

| 工具名 | 用途 |
| --- | --- |
| `desktop-commander_create_directory` | 创建目录 |
| `desktop-commander_edit_block` | 精确编辑文件块 |
| `desktop-commander_force_terminate` | 强杀终端会话 |
| `desktop-commander_get_config` | 获取服务器配置 |
| `desktop-commander_get_file_info` | 获取文件/目录元数据 |
| `desktop-commander_get_more_search_results` | 分页读取搜索结果 |
| `desktop-commander_get_recent_tool_calls` | 最近工具调用历史 |
| `desktop-commander_get_usage_stats` | 工具使用统计 |
| `desktop-commander_give_feedback_to_desktop_commander` | 打开反馈表单 |
| `desktop-commander_interact_with_process` | 向进程发送输入 |
| `desktop-commander_kill_process` | 按 PID 杀进程 |
| `desktop-commander_list_directory` | 列出目录内容 |
| `desktop-commander_list_processes` | 列出进程 |
| `desktop-commander_list_searches` | 列出活动搜索 |
| `desktop-commander_list_sessions` | 列出活动终端会话 |
| `desktop-commander_move_file` | 移动/重命名文件 |
| `desktop-commander_read_file` | 读取文件/URL |
| `desktop-commander_read_multiple_files` | 批量读文件 |
| `desktop-commander_read_process_output` | 读取进程输出 |
| `desktop-commander_set_config_value` | 设置配置项 |
| `desktop-commander_start_process` | 启动终端进程 |
| `desktop-commander_start_search` | 启动流式搜索 |
| `desktop-commander_stop_search` | 停止搜索 |
| `desktop-commander_write_file` | 写入文件 |
| `desktop-commander_write_pdf` | 创建/修改 PDF |

## 7. MCP：github

| 工具名 | 用途 |
| --- | --- |
| `github_add_issue_comment` | 给 issue 加评论 |
| `github_create_branch` | 创建分支 |
| `github_create_issue` | 创建 issue |
| `github_create_or_update_file` | 创建/更新文件 |
| `github_create_pull_request` | 创建 PR |
| `github_create_pull_request_review` | 创建 PR 评审 |
| `github_create_repository` | 创建仓库 |
| `github_fork_repository` | fork 仓库 |
| `github_get_file_contents` | 获取文件/目录内容 |
| `github_get_issue` | 获取 issue 详情 |
| `github_get_pull_request` | 获取 PR 详情 |
| `github_get_pull_request_comments` | 获取 PR 评论 |
| `github_get_pull_request_files` | 获取 PR 文件列表 |
| `github_get_pull_request_reviews` | 获取 PR 评审 |
| `github_get_pull_request_status` | 获取 PR 状态检查 |
| `github_list_commits` | 列出提交 |
| `github_list_issues` | 列出 issue |
| `github_list_pull_requests` | 列出 PR |
| `github_merge_pull_request` | 合并 PR |
| `github_push_files` | 推送多文件 |
| `github_search_code` | 搜索代码 |
| `github_search_issues` | 搜索 issue/PR |
| `github_search_repositories` | 搜索仓库 |
| `github_search_users` | 搜索用户 |
| `github_update_issue` | 更新 issue |
| `github_update_pull_request_branch` | 更新 PR 分支 |

## 8. MCP：playwright

| 工具名 | 用途 |
| --- | --- |
| `playwright_clear_codegen_session` | 清除代码生成会话 |
| `playwright_end_codegen_session` | 结束并生成测试文件 |
| `playwright_get_codegen_session` | 获取代码生成会话信息 |
| `playwright_start_codegen_session` | 启动代码生成会话 |
| `playwright_playwright_assert_response` | 断言 HTTP 响应 |
| `playwright_playwright_click` | 点击元素 |
| `playwright_playwright_click_and_switch_tab` | 点击链接并切标签页 |
| `playwright_playwright_close` | 关闭浏览器 |
| `playwright_playwright_console_logs` | 获取控制台日志 |
| `playwright_playwright_custom_user_agent` | 设置自定义 UA |
| `playwright_playwright_delete` | HTTP DELETE |
| `playwright_playwright_drag` | 拖拽元素 |
| `playwright_playwright_evaluate` | 执行浏览器 JS |
| `playwright_playwright_expect_response` | 等待 HTTP 响应 |
| `playwright_playwright_fill` | 填充输入框 |
| `playwright_playwright_get` | HTTP GET |
| `playwright_playwright_get_visible_html` | 获取可见 HTML |
| `playwright_playwright_get_visible_text` | 获取可见文本 |
| `playwright_playwright_go_back` | 后退 |
| `playwright_playwright_go_forward` | 前进 |
| `playwright_playwright_hover` | 悬停元素 |
| `playwright_playwright_iframe_click` | iframe 内点击 |
| `playwright_playwright_iframe_fill` | iframe 内填充 |
| `playwright_playwright_navigate` | 导航到 URL |
| `playwright_playwright_patch` | HTTP PATCH |
| `playwright_playwright_post` | HTTP POST |
| `playwright_playwright_press_key` | 按键 |
| `playwright_playwright_put` | HTTP PUT |
| `playwright_playwright_resize` | 调整视口 |
| `playwright_playwright_save_as_pdf` | 存为 PDF |
| `playwright_playwright_screenshot` | 截图 |
| `playwright_playwright_select` | 选择下拉项 |
| `playwright_playwright_upload_file` | 上传文件 |

## 9. 统计

- 内置：27 个
- MCP agent_manager：1 个
- MCP background_process：1 个
- MCP caura：12 个
- MCP context7：2 个
- MCP desktop-commander：25 个
- MCP github：26 个
- MCP playwright：33 个
- **合计：约 127 个**
