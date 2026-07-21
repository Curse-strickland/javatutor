from runtime import Args
from typings.a.a import Input, Output
import json

"""
JavaTutor 数据处理插件 — 将后端传来的原始 JSON 拆解为结构化字段，供下游节点引用和分支路由。

输入：
  raw_message (String): 后端发来的原始 JSON 字符串

输出：
  source_code       (String)  - 完整 Java 源码
  steps_json        (String)  - 全部执行步骤 JSON
  steps_count       (Integer) - 总步骤数
  has_steps         (Boolean) - 是否有执行数据
  current_step_index (Integer) - 当前查看的步骤序号
  current_line      (Integer) - 当前高亮行号
  current_variables (String)  - 当前步骤变量快照 JSON
  user_question     (String)  - 学生原始问题
  user_id           (String)  - 学生唯一标识
  compile_error     (String)  - 编译错误原文
  has_error         (Boolean) - 是否有编译错误
"""


def handler(args: Args[Input]) -> Output:
    raw = args.input.raw_message
    args.logger.info(f"[JavaTutor] Received raw message, length: {len(raw)}")

    # ========== 1. 解析 JSON ==========
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        args.logger.error(f"[JavaTutor] JSON parse failed: {e}")
        return {
            "source_code": "",
            "steps_json": "[]",
            "steps_count": 0,
            "has_steps": False,
            "current_step_index": -1,
            "current_line": -1,
            "current_variables": "{}",
            "user_question": raw if raw else "",
            "user_id": "",
            "compile_error": "",
            "has_error": False,
        }

    # ========== 2. 提取基础字段 ==========
    source_code = data.get("source_code", "")
    steps = data.get("steps", [])
    current_step_index = data.get("current_step_index", -1)
    current_line = data.get("current_line", -1)
    user_question = data.get("user_question", "")
    user_id = data.get("user_id", "")
    compile_error = data.get("compile_error", "")

    # ========== 3. 派生字段 ==========
    steps_count = len(steps) if isinstance(steps, list) else 0
    has_steps = steps_count > 0
    has_error = bool(compile_error) and compile_error.strip() != ""

    # ========== 4. 提取当前步骤变量 ==========
    current_variables = "{}"
    if has_steps and 0 <= current_step_index < steps_count:
        step_data = steps[current_step_index]
        vars_data = step_data.get("variables", {})
        current_variables = json.dumps(vars_data, ensure_ascii=False)

    # ========== 5. 序列化 ==========
    steps_json = json.dumps(steps, ensure_ascii=False) if steps else "[]"

    args.logger.info(
        f"[JavaTutor] Parsed: steps={steps_count}, "
        f"has_steps={has_steps}, has_error={has_error}, "
        f"current_step={current_step_index}, line={current_line}, "
        f"question_len={len(user_question)}"
    )

    # ========== 6. 返回结构化字段 ==========
    return {
        "source_code": source_code,
        "steps_json": steps_json,
        "steps_count": steps_count,
        "has_steps": has_steps,
        "current_step_index": current_step_index,
        "current_line": current_line,
        "current_variables": current_variables,
        "user_question": user_question,
        "user_id": user_id,
        "compile_error": compile_error,
        "has_error": has_error,
    }
