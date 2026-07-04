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
    title: "Danh sách người mẫu",
    method: "GET",
    path: "/v1/models",
    icon: ListChecks,
    input: [
      ["Authorization", "header", "Bearer <auth-key>。"],
    ],
    output: [
      ["data", "array", "Danh sách mô hình, bao gồm id, đối tượng, được tạo, sở hữu_by."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/models \\
  -H "Authorization: Bearer ${key}"`,
  },
  {
    title: "Hoàn thành trò chuyện",
    method: "POST",
    path: "/v1/chat/completions",
    icon: FileText,
    input: [
      ["model", "string", "Tên mẫu máy, chẳng hạn như gpt-5-mini, cũng có thể được sử dụng trong các trường hợp tương thích với hình ảnh."],
      ["messages", "array", "Mảng tin nhắn tương thích OpenAI."],
      ["stream", "boolean", "Tùy chọn, có phát online trả lại hay không."],
      ["n", "number", "Tùy chọn, các kịch bản tương thích với hình ảnh sẽ giải quyết theo số lượng được tạo."],
    ],
    output: [
      ["id", "string", "ID phản hồi."],
      ["choices", "array", "Các lựa chọn tương thích với OpenAI."],
      ["usage", "object", "Tùy chọn, thông tin sử dụng token."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gpt-5-mini","messages":[{"role":"user","content":"xin chào"}]}'`,
  },
  {
    title: "Responses",
    method: "POST",
    path: "/v1/responses",
    icon: FileText,
    input: [
      ["model", "string", "Tên mẫu."],
      ["input", "string | array | object", "Đầu vào của người dùng, từ đó việc tạo hình ảnh sẽ phân tích các từ gợi ý."],
      ["tools", "array", "Tùy chọn, định nghĩa công cụ Phản hồi."],
      ["stream", "boolean", "Tùy chọn, có phát online trả lại hay không."],
    ],
    output: [
      ["id", "string", "ID phản hồi."],
      ["output", "array", "Phản hồi đầu ra tương thích."],
      ["status", "string", "Trạng thái phản hồi."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gpt-5-mini","input":"Tạo ra hình ảnh của một thành phố trong tương lai"}'`,
  },
  {
    title: "Tìm kiếm",
    method: "POST",
    path: "/v1/search",
    icon: ListChecks,
    input: [
      ["prompt", "string", "Tìm kiếm câu hỏi hoặc lấy hướng dẫn."],
    ],
    output: [
      ["answer", "string", "Nội dung đáp án sau khi tìm kiếm, các trường cụ thể sẽ có kết quả trả về."],
      ["sources", "array", "Tùy chọn, tìm kiếm các nguồn được trích dẫn."],
      ["_account_email", "string", "Email tài khoản được sử dụng lần này."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/search \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"prompt":"Tìm kiếm cách sử dụng mới nhất của chatgpt2api"}'`,
  },
  {
    title: "Tạo hình ảnh",
    method: "POST",
    path: "/v1/images/generations",
    icon: FileArchive,
    input: [
      ["prompt", "string", "Hình ảnh tạo ra lời nhắc."],
      ["model", "string", "Tùy chọn, mặc định là gpt-image-2."],
      ["n", "number", "Tùy chọn, số lượng được tạo, hiện giới hạn ở mức 1-4."],
      ["size", "string", "Tùy chọn, kích thước hình ảnh."],
      ["quality", "string", "Tùy chọn, mặc định là tự động."],
      ["response_format", "string", "Tùy chọn, mặc định là b64_json."],
    ],
    output: [
      ["data", "array", "Danh sách kết quả hình ảnh."],
      ["data[].b64_json", "string", "nội dung hình ảnh base64."],
      ["data[].url", "string", "Trả về URL hình ảnh theo cấu hình một phần."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/images/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gpt-image-2","prompt":"Poster sản phẩm tối giản","n":1}'`,
  },
  {
    title: "Chỉnh sửa ảnh",
    method: "POST",
    path: "/v1/images/edits",
    icon: FileArchive,
    input: [
      ["image", "file | file[] | URL", "Hình ảnh tham khảo hỗ trợ tải lên nhiều phần và liên kết hình ảnh JSON."],
      ["prompt", "string", "Chỉnh sửa lời nhắc."],
      ["model", "string", "Tùy chọn, mặc định là gpt-image-2."],
      ["n", "number", "Tùy chọn, số lượng được tạo, hiện giới hạn ở mức 1-4."],
      ["size", "string", "Tùy chọn, kích thước hình ảnh."],
      ["quality", "string", "Tùy chọn, mặc định là tự động."],
    ],
    output: [
      ["data", "array", "Danh sách kết quả hình ảnh đã chỉnh sửa."],
      ["data[].b64_json", "string", "nội dung hình ảnh base64."],
      ["data[].url", "string", "Trả về URL hình ảnh theo cấu hình một phần."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/images/edits \\
  -H "Authorization: Bearer ${key}" \\
  -F "model=gpt-image-2" \\
  -F "nhắc=Đổi sang cảnh đêm cyberpunk" \\
  -F "image=@./input.png"`,
  },
  {
    title: "Tạo tác vụ PPT",
    method: "POST",
    path: "/v1/ppt/generations",
    icon: FileText,
    input: [
      ["prompt", "string", "Mô tả yêu cầu PPT, có thể để trống nhưng nên điền đầy đủ chủ đề, số trang, văn phong và cấu trúc nội dung."],
      ["base64_images", "string[]", "Tùy chọn, URL dữ liệu hình ảnh/base64, được sử dụng làm tài liệu tham chiếu PPT."],
      ["client_task_id", "string", "ID tác vụ bình thường phía máy khách, tùy chọn; việc gửi đi lặp lại với cùng một ID sẽ trả về các nhiệm vụ hiện có."],
    ],
    output: [
      ["id / taskId", "string", "ID nhiệm vụ cho trạng thái bỏ phiếu."],
      ["status", "queued | running | success | error", "Trạng thái nhiệm vụ."],
      ["kind", "ppt", "Loại nhiệm vụ."],
      ["created_at / updated_at", "string", "Thời gian tạo và cập nhật nhiệm vụ."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/ppt/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"prompt":"Tạo báo cáo kinh doanh hàng quý PPT trong vòng 8 trang","base64_images":[]}'`,
  },
  {
    title: "Tạo tác vụ PSD",
    method: "POST",
    path: "/v1/psd/generations",
    icon: FileArchive,
    input: [
      ["prompt", "string", "Các yêu cầu phân tách và tổng hợp PSD như bảo toàn các lớp, vị trí, hình nền và đoạn phim."],
      ["base64_images", "string[]", "Bắt buộc, ít nhất một URL dữ liệu hình ảnh/base64, dưới dạng hình ảnh nguồn phân tách PSD."],
      ["client_task_id", "string", "Tùy chọn, ID nhiệm vụ bình thường của khách hàng."],
    ],
    output: [
      ["id / taskId", "string", "ID nhiệm vụ cho trạng thái bỏ phiếu."],
      ["status", "queued | running | success | error", "Trạng thái nhiệm vụ."],
      ["kind", "psd", "Loại nhiệm vụ."],
      ["error", "string", "Trả về thông báo lỗi khi thất bại."],
    ],
    example: (baseUrl: string, key: string) => `curl ${baseUrl}/psd/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"prompt":"Tách các phần tử poster theo vị trí ảnh gốc và kết hợp chúng thành PSD có thể chỉnh sửa","base64_images":["data:image/png;base64,..."]}'`,
  },
  {
    title: "Truy vấn trạng thái nhiệm vụ",
    method: "GET",
    path: "/v1/editable-file-tasks?ids={taskId1,taskId2}",
    icon: ListChecks,
    input: [
      ["ids", "string", "ID tác vụ tùy chọn, được phân tách bằng dấu phẩy; nếu không được thông qua, tất cả các tác vụ tệp có thể chỉnh sửa cho người dùng hiện tại sẽ được trả về."],
    ],
    output: [
      ["items", "array", "Danh sách nhiệm vụ. Kết quả của một tác vụ thành công chứa Primary_url và Zip_url."],
      ["missing_ids", "string[]", "Khi truy vấn các id đã chỉ định, trả về không tìm thấy ID tác vụ."],
      ["result.primary_url", "string", "Địa chỉ tải tập tin chính."],
      ["result.zip_url", "string", "Địa chỉ tải xuống zip tài liệu."],
    ],
    example: (baseUrl: string, key: string) => `curl "${baseUrl}/editable-file-tasks?ids=<task_id>" \\
  -H "Authorization: Bearer ${key}"`,
  },
  {
    title: "Tải file kết quả",
    method: "GET",
    path: "/files/{file_path}",
    icon: FileArchive,
    input: [
      ["file_path", "string", "Được trả về bởi task result.primary_url hoặc result.zip_url, thường không cần phải ghép nối thủ công."],
    ],
    output: [
      ["binary", "file", "Trả về luồng tệp pptx/psd/zip."],
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
            <th className="px-3 py-2 font-medium">thông số</th>
            <th className="px-3 py-2 font-medium">loại</th>
            <th className="px-3 py-2 font-medium">Mô tả</th>
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
  const displayKey = authKey || "<khóa hiện tại>";

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
            Tài liệu hướng dẫn API
          </div>
          <p className="mt-1 text-xs leading-6 text-stone-500">
            Nút ứng dụng của bên thứ ba OpenAI Tích hợp API tương thích；API tác vụ tệp cũng sử dụng phương thức xác thực tương tự.。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">Địa chỉ dịch vụ</div>
            <div className="break-all font-mono text-xs text-stone-800">{serviceBaseUrl}</div>
          </div>
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">Base URL（OpenAI）</div>
            <div className="break-all font-mono text-xs text-stone-800">{openAIBaseUrl}</div>
          </div>
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">API Key</div>
            <div className="break-all font-mono text-xs text-stone-800">{displayKey}</div>
          </div>
          <div className="space-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="text-xs text-stone-500">Tiêu đề yêu cầu</div>
            <div className="break-all font-mono text-xs text-stone-800">Authorization: Bearer {displayKey}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-stone-600">Các mô hình thường được sử dụng cũng có thể được lấy bằng cách yêu cầu /v1/models</div>
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
                    <h3 className="text-xs font-semibold text-stone-700">thông số đầu vào</h3>
                    <ParamTable rows={item.input} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-stone-700">Thông số đầu ra</h3>
                    <ParamTable rows={item.output} />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <h3 className="text-xs font-semibold text-stone-700">Ví dụ cuộc gọi</h3>
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
