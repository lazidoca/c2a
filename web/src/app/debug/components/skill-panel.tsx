"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import webConfig from "@/constants/common-env";
import { fetchSettingsConfig } from "@/lib/api";
import { getStoredAuthSession } from "@/store/auth";

export function SkillPanel() {
  const [browserBaseUrl, setBrowserBaseUrl] = useState("");
  const [configuredBaseUrl, setConfiguredBaseUrl] = useState("");
  const [authKey, setAuthKey] = useState("");

  useEffect(() => {
    setBrowserBaseUrl(window.location.origin);
    void fetchSettingsConfig().then((data) => setConfiguredBaseUrl(String(data.config.base_url || "").replace(/\/$/, ""))).catch(() => undefined);
    void getStoredAuthSession().then((session) => setAuthKey(session?.key || ""));
  }, []);

  const apiBaseUrl = configuredBaseUrl || webConfig.apiUrl.replace(/\/$/, "") || browserBaseUrl;
  const skillZh = useMemo(() => `---
name: chatgpt2api-search
description: 当用户需要在线搜索、查询最新信息、验证事实或需要源链接时，调用本地 chatgpt2api 搜索接口。
---

# ChatGPT2API Search

当用户要求在互联网上搜索、查询最新信息、验证信息、检查新闻、查询价格、检查文档更新或需要源链接时，使用此 skill。

## 接口

POST ${apiBaseUrl}/v1/search

Headers:

Authorization: Bearer ${authKey}
Content-Type: application/json

Body:

{
  "prompt": "<用户要搜索的问题>"
}

## 后端处理

- API 返回的 \`answer\` 将作为主要回答。
- 如果有 \`sources\`，请在回答中包含源链接。
- 如果 API 报错，简要描述错误并询问是否重试。`, [apiBaseUrl, authKey]);

  const skillEn = useMemo(() => `---
name: chatgpt2api-search
description: Use when current web search is needed through this chatgpt2api server. Call the configured HTTP search endpoint with a prompt and return the answer with source URLs.
---

# ChatGPT2API Search

Use this skill when the user asks for current web search, online lookup, recent information, or source-backed answers. It calls the local chatgpt2api search endpoint and returns an answer with source links.

## When to use

- The user asks to search the web, look something up, verify current information, or find the latest status.
- The answer needs source URLs, recent details, prices, releases, docs, laws, schedules, or news.
- Do not use it for purely local codebase questions unless the user explicitly asks for web search.

## Request

POST ${apiBaseUrl}/v1/search

Headers:

Authorization: Bearer ${authKey}
Content-Type: application/json

JSON body:

{
  "prompt": "<search question>"
}

## Response handling

- Use \`answer\` as the main response.
- Include source URLs from \`sources\` when available.
- If the endpoint returns an error, summarize the error and ask the user whether to retry.
- Keep the final answer concise unless the user asks for detail.`, [apiBaseUrl, authKey]);

  const zhPrompt = useMemo(() => `请帮我在这台机器上安装一个用于在互联网上搜索的 skill。

要求：
1. 请根据你当前环境的 skill 安装规范，在本地安装它。
2. skill 名称为：chatgpt2api-search
3. 文件名为：SKILL.md
4. 如果你无法确定本地 skills 目录在哪里，先告诉我需要放在哪个目录下，不要盲猜路径。
5. 仅创建或更新此 skill 文件，不要修改其他无关文件。
6. SKILL.md 请完整写入以下内容。

SKILL.md 内容：

\`\`\`markdown
${skillZh}
\`\`\``, [skillZh]);

  const enPrompt = useMemo(() => `Please install a local web-search skill on this machine.

Requirements:
1. Install this as a local skill according to the skill installation rules of your current environment.
2. Skill name: chatgpt2api-search
3. File name: SKILL.md
4. If you cannot determine the local skills directory, tell me which directory is required before writing files.
5. Only create or update this skill file. Do not modify unrelated files.
6. Write the full content below into SKILL.md.

SKILL.md content:

\`\`\`markdown
${skillEn}
\`\`\``, [skillEn]);

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const downloadSkill = (text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "SKILL.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const versions = [
    { title: "Chinese installation prompt", desc: "Copy and send directly to Codex or Claude to install locally.", prompt: zhPrompt, skill: skillZh },
    { title: "English installation prompt", desc: "Copy and send this to Codex or Claude to install locally.", prompt: enPrompt, skill: skillEn },
  ];

  return (
    <section className="grid items-stretch gap-4 lg:grid-cols-2">
      {versions.map((item) => (
        <div key={item.title} className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div>
              <h2 className="font-medium text-slate-900 dark:text-slate-100">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => downloadSkill(item.skill)}>
                <Download />
                Download
              </Button>
              <Button size="sm" className="cursor-pointer" onClick={() => void copyText(item.prompt)}>
                <Copy />
                Copy
              </Button>
            </div>
          </div>
          <pre className="flex-1 whitespace-pre-wrap p-4 font-mono text-sm leading-6">
            {item.prompt}
          </pre>
        </div>
      ))}
    </section>
  );
}
