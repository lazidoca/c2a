"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileArchive, FileText, KeyRound, ListChecks, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import webConfig from "@/constants/common-env";
import { getStoredAuthSession } from "@/store/auth";

type ParamRow = [string, string, string];

type ApiDoc = {
  title: string;
  method: string;
  path: string;
  icon: LucideIcon;
  input: ParamRow[];
  output: ParamRow[];
  example: (baseUrl: string, key: string) => string;
};

const docs: ApiDoc[] = [
  {
    title: "Model List",
    method: "GET",
    path: "/v1/models",
    icon: ListChecks,
    input: [
      ["Authorization", "header", "Bearer <auth-key>."],
    ],
    output: [
      ["data", "array", "List of models, including id, object, created, owned_by."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/models \\
  -H "Authorization: Bearer ${key}"`,
  },
  {
    title: "Chat Completions",
    method: "POST",
    path: "/v1/chat/completions",
    icon: FileText,
    input: [
      ["model", "string", "Model name, such as gpt-5-mini; can also be used in image-compatible contexts."],
      ["messages", "array", "OpenAI compatible message array."],
      ["stream", "boolean", "Optional; whether to stream responses back (SSE)."],
      ["n", "number", "Optional; image-generation compatible scenario specifying number of generations."],
    ],
    output: [
      ["id", "string", "Response ID."],
      ["choices", "array", "OpenAI compatible choices."],
      ["usage", "object", "Optional; token usage details."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gpt-5-mini","messages":[{"role":"user","content":"hello"}]}'`,
  },
  {
    title: "Responses",
    method: "POST",
    path: "/v1/responses",
    icon: FileText,
    input: [
      ["model", "string", "Model name."],
      ["input", "string | array | object", "User input, from which image generation will extract prompt text."],
      ["tools", "array", "Optional; response tool definition."],
      ["stream", "boolean", "Optional; whether to stream responses back (SSE)."],
    ],
    output: [
      ["id", "string", "Response ID."],
      ["output", "array", "Compatible output response."],
      ["status", "string", "Response status."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gpt-5-mini","input":"Generate an image of a futuristic city"}'`,
  },
  {
    title: "Search",
    method: "POST",
    path: "/v1/search",
    icon: ListChecks,
    input: [
      ["prompt", "string", "Search query or prompt."],
    ],
    output: [
      ["answer", "string", "Search answer content, response structure contains matching details."],
      ["sources", "array", "Optional; cited sources."],
      ["_account_email", "string", "Email account used for this request."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/search \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"prompt":"Search for chatgpt2api latest usage"}'`,
  },
  {
    title: "Generate image",
    method: "POST",
    path: "/v1/images/generations",
    icon: FileArchive,
    input: [
      ["prompt", "string", "Image generation prompt."],
      ["model", "string", "Optional; defaults to gpt-image-2."],
      ["n", "number", "Optional; number of generations, currently limited to 1-4."],
      ["size", "string", "Optional; image size."],
      ["quality", "string", "Optional; defaults to auto."],
      ["response_format", "string", "Optional; defaults to b64_json."],
    ],
    output: [
      ["data", "array", "List of generated image results."],
      ["data[].b64_json", "string", "Base64 image content."],
      ["data[].url", "string", "Returns image URL under partial configurations."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/images/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gpt-image-2","prompt":"Minimalist product poster","n":1}'`,
  },
  {
    title: "Edit Image",
    method: "POST",
    path: "/v1/images/edits",
    icon: FileArchive,
    input: [
      ["image", "file | file[] | URL", "Reference image; supports multipart upload and JSON image URL."],
      ["prompt", "string", "Image edit prompt."],
      ["model", "string", "Optional; defaults to gpt-image-2."],
      ["n", "number", "Optional; number of generations, currently limited to 1-4."],
      ["size", "string", "Optional; image size."],
      ["quality", "string", "Optional; defaults to auto."],
    ],
    output: [
      ["data", "array", "List of edited image results."],
      ["data[].b64_json", "string", "Base64 image content."],
      ["data[].url", "string", "Returns image URL under partial configurations."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/images/edits \\
  -H "Authorization: Bearer ${key}" \\
  -F "model=gpt-image-2" \\
  -F "prompt=Change to cyberpunk night view" \\
  -F "image=@./input.png"`,
  },
  {
    title: "Create PPT Task",
    method: "POST",
    path: "/v1/ppt/generations",
    icon: FileText,
    input: [
      ["prompt", "string", "Description of the PPT request; can be empty but recommended to specify topic, pages, style, and structure."],
      ["base64_images", "string[]", "Optional; image data/base64 URL, used as reference material for PPT."],
      ["client_task_id", "string", "Client-side unique task ID; resubmitting with same ID returns existing task."],
    ],
    output: [
      ["id / taskId", "string", "Task ID for status polling."],
      ["status", "queued | running | success | error", "Task status."],
      ["kind", "ppt", "Task type."],
      ["created_at / updated_at", "string", "Task creation and update timestamps."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/ppt/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"prompt":"Generate a quarterly business report PPT within 8 pages","base64_images":[]}'`,
  },
  {
    title: "Create PSD Task",
    method: "POST",
    path: "/v1/psd/generations",
    icon: FileArchive,
    input: [
      ["prompt", "string", "PSD layer separation and synthesis requirements like keeping layers, coordinates, background, and video."],
      ["base64_images", "string[]", "Required; at least one image/base64 URL, used as the source for PSD layer separation."],
      ["client_task_id", "string", "Optional; client-side unique task ID."],
    ],
    output: [
      ["id / taskId", "string", "Task ID for status polling."],
      ["status", "queued | running | success | error", "Task status."],
      ["kind", "psd", "Task type."],
      ["error", "string", "Error message returned on failure."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/psd/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"prompt":"Separate poster elements matching the original positions and synthesize into editable PSD","base64_images":["data:image/png;base64,..."]}'`,
  },
  {
    title: "Query Task Status",
    method: "GET",
    path: "/v1/editable-file-tasks?ids={taskId1,taskId2}",
    icon: ListChecks,
    input: [
      ["ids", "string", "Optional comma-separated task IDs; if omitted, returns all editable file tasks for the current user."],
    ],
    output: [
      ["items", "array", "Task list. A successful task result contains primary_url and zip_url."],
      ["missing_ids", "string[]", "Returns missing IDs when queried task IDs are not found."],
      ["result.primary_url", "string", "Primary file download address."],
      ["result.zip_url", "string", "Document zip download address."],
    ],
    example: (baseUrl: string, key: string) => `curl "${baseUrl}/editable-file-tasks?ids=<task_id>" \\
  -H "Authorization: Bearer ${key}"`,
  },
  {
    title: "Download Result File",
    method: "GET",
    path: "/files/{file_path}",
    icon: FileArchive,
    input: [
      ["file_path", "string", "Returned by task result.primary_url or result.zip_url; usually parsed automatically."],
    ],
    output: [
      ["binary", "file", "Returns binary stream of pptx/psd/zip file."],
    ],
    example: (baseUrl: string, _key: string) => `curl ${baseUrl.replace(/\/v1$/, "")}/files/<file_path> -o result.zip`,
  },
];

const usableModels = ["gpt-image-2", "codex-gpt-image-2", "auto", "gpt-5", "gpt-5-1", "gpt-5-2", "gpt-5-3", "gpt-5-3-mini", "gpt-5-mini"];

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 text-stone-500">
          <tr>
            <th className="px-3 py-2 font-medium">parameter</th>
            <th className="px-3 py-2 font-medium">type</th>
            <th className="px-3 py-2 font-medium">description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 bg-white">
          {rows.map(([name, type, desc]) => (
            <tr key={name}>
              <td className="px-3 py-2 font-mono text-stone-800">{name}</td>
              <td className="px-3 py-2 font-mono text-stone-500">{type}</td>
              <td className="px-3 py-2 text-stone-600">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApiDocsCard() {
  const [authKey, setAuthKey] = useState("");
  const serviceBaseUrl = webConfig.apiUrl.replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
  const openAIBaseUrl = `${serviceBaseUrl}/v1`;
  const displayKey = authKey || "<current-key>";

  useEffect(() => {
    let active = true;
    void getStoredAuthSession().then((session) => {
      if (active) setAuthKey(session?.key || "");
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <KeyRound className="size-5 text-stone-500" />
            API Documentation
          </div>
          <p className="mt-1 text-xs leading-6 text-stone-500">
            Compatible with third-party OpenAI client integration. File tasks API uses the same authentication mechanism.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">Service Address</div>
            <div className="break-all font-mono text-xs text-stone-800">{serviceBaseUrl}</div>
          </div>
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">Base URL (OpenAI)</div>
            <div className="break-all font-mono text-xs text-stone-800">{openAIBaseUrl}</div>
          </div>
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">API Key</div>
            <div className="break-all font-mono text-xs text-stone-800">{displayKey}</div>
          </div>
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">Request Header</div>
            <div className="break-all font-mono text-xs text-stone-800">Authorization: Bearer {displayKey}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-stone-600">Commonly used models; can also be retrieved by querying /v1/models</div>
          <div className="flex flex-wrap gap-2">
            {usableModels.map((model) => (
              <span key={model} className="rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs text-stone-700">{model}</span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {docs.map((item) => {
            const Icon = item.icon;
            return (
              <details key={item.path} className="group rounded-xl border border-stone-200 bg-white px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-stone-900">{item.title}</span>
                      <span className="mt-1 block truncate font-mono text-xs text-stone-500">{item.method} {item.path}</span>
                    </span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-stone-400 transition group-open:rotate-180" />
                </summary>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-stone-700">Input Parameters</h3>
                    <ParamTable rows={item.input} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-stone-700">Output Parameters</h3>
                    <ParamTable rows={item.output} />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <h3 className="text-xs font-semibold text-stone-700">Example Request</h3>
                    <pre className="overflow-auto whitespace-pre-wrap break-all rounded-xl bg-stone-950 px-3 py-3 text-xs leading-5 text-stone-100">{item.example(openAIBaseUrl, displayKey)}</pre>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
