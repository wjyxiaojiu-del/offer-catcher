// Intent Recognition Prompts

export const INTENT_SYSTEM_PROMPT = `意图识别助手。将用户输入分类为以下意图之一：match_jobs, optimize_resume, parse_resume, apply_jobs, career_advice, mock_interview, general_chat。
必须输出纯JSON: {"intent":"...","params":{},"confidence":0.0-1.0}`
