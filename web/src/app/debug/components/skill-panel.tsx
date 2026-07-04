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
description: Khi người dùng có nhu cầu tìm kiếm online、Kiểm tra thông tin mới nhất、Khi xác minh sự thật hoặc cần một liên kết đến một nguồn，gọi địa phương chatgpt2api Giao diện tìm kiếm。
---

# ChatGPT2API Tìm kiếm

Khi người dùng yêu cầu tìm kiếm trên Internet、Kiểm tra thông tin mới nhất、Xác minh thông tin、kiểm tra tin tức、Kiểm tra giá、Khi kiểm tra cập nhật tài liệu hoặc khi bạn cần liên kết nguồn，sử dụng cái này skill。

## giao diện

POST ${apiBaseUrl}/v1/search

Headers:

Authorization: Bearer ${authKey}
Content-Type: application/json

Body:

{
  "prompt": "<Câu hỏi người dùng đang tìm kiếm>"
}

## Quay lại xử lý

- được trả về từ API \`answer\` như câu trả lời chính。
- nếu có \`sources\`，Bao gồm một liên kết nguồn trong câu trả lời của bạn。
- Nếu API báo lỗi，Mô tả ngắn gọn lỗi và hỏi xem bạn có muốn thử lại không。`, [apiBaseUrl, authKey]);

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

  const zhPrompt = useMemo(() => `Xin hãy giúp tôi cài đặt một cái để tìm kiếm trên Internet trên máy này skill。

yêu cầu：
1. Vui lòng nhấp vào môi trường hiện tại của bạn skill Thông số kỹ thuật cài đặt，cài đặt nó cục bộ skill。
2. skill Tên là：chatgpt2api-search
3. Tên tập tin là：SKILL.md
4. Nếu bạn không thể xác định địa phương skills thư mục ở đâu，Đầu tiên hãy cho tôi biết tôi cần đặt nó vào thư mục nào，Đừng đoán đường đi。
5. Chỉ tạo hoặc cập nhật cái này skill tập tin，Không sửa đổi các tập tin không liên quan khác。
6. SKILL.md Hãy viết đầy đủ nội dung bên dưới。

SKILL.md nội dung：

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
    toast.success("Đã sao chép");
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
    { title: "Hướng dẫn cài đặt tiếng Trung", desc: "Sau khi sao chép, hãy gửi trực tiếp đến Codex hoặc Claude và để nó được cài đặt cục bộ.", prompt: zhPrompt, skill: skillZh },
    { title: "English install prompt", desc: "Copy and send this to Codex or Claude to install locally.", prompt: enPrompt, skill: skillEn },
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
                Tải xuống
              </Button>
              <Button size="sm" className="cursor-pointer" onClick={() => void copyText(item.prompt)}>
                <Copy />
                Sao chép
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
