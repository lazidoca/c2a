"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  FileJson,
  FileText,
  Files,
  KeyRound,
  LoaderCircle,
  LogIn,
  ServerCog,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  createAccounts,
  finishOAuthLogin,
  startOAuthLogin,
  type Account,
  type AccountImportPayload,
  type OAuthLoginStartResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ImportMethod = "menu" | "token" | "session" | "codex-auth" | "account-json" | "oauth";

type AccountImportDialogProps = {
  disabled?: boolean;
  onImported: (items: Account[]) => void;
};

type PendingAccountJsonImport = {
  tokens: string[];
  accounts: AccountImportPayload[];
  parsedAccountCount: number;
  errorCount: number;
};

const sessionUrl = "https://chatgpt.com/api/auth/session";

function splitTokens(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSessionAccessToken(value: unknown) {
  const token = (value as { accessToken?: unknown })?.accessToken;
  return typeof token === "string" ? token.trim() : "";
}

function getAccountJsonAccount(value: unknown): AccountImportPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const tokenValue = raw.access_token ?? raw.accessToken;
  const token = typeof tokenValue === "string" ? tokenValue.trim() : "";
  if (!token) {
    return null;
  }

  const payload: AccountImportPayload = {
    ...raw,
    access_token: token,
    source_type: "codex",
  };
  delete payload.accessToken;
  if (payload.type === "codex") {
    payload.export_type = "codex";
    delete payload.type;
  }
  return payload;
}

function getAccountJsonAccounts(value: unknown): AccountImportPayload[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => getAccountJsonAccount(item))
      .filter((item): item is AccountImportPayload => Boolean(item));
  }

  const singleAccount = getAccountJsonAccount(value);
  if (singleAccount) {
    return [singleAccount];
  }

  if (value && typeof value === "object") {
    const raw = value as Record<string, unknown>;
    const nested = raw.accounts ?? raw.items;
    if (Array.isArray(nested)) {
      return nested
        .map((item) => getAccountJsonAccount(item))
        .filter((item): item is AccountImportPayload => Boolean(item));
    }
  }

  return [];
}

function getCodexAuthAccount(value: unknown): AccountImportPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const tokenValue = raw.access_token ?? raw.accessToken;
  const token = typeof tokenValue === "string" ? tokenValue.trim() : "";
  if (!token) {
    return null;
  }

  const payload: AccountImportPayload = {
    ...raw,
    access_token: token,
    export_type: "codex",
    source_type: "codex",
  };
  delete payload.accessToken;
  if (payload.type === "codex") {
    delete payload.type;
  }
  return payload;
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error(`Không đọc được tệp: ${file.name}`));
    reader.readAsText(file);
  });
}

function MethodCard({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: typeof KeyRound;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-stone-200 bg-white p-0 text-left transition hover:border-stone-300 hover:bg-stone-50"
    >
      <Card className="rounded-2xl border-0 bg-transparent shadow-none">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="rounded-xl bg-stone-100 p-3 text-stone-700">
            <Icon className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-stone-900">{title}</div>
            <div className="text-sm leading-6 text-stone-500">{description}</div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export function AccountImportDialog({ disabled, onImported }: AccountImportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ImportMethod>("menu");
  const [tokenInput, setTokenInput] = useState("");
  const [sessionInput, setSessionInput] = useState("");
  const [codexAuthInput, setCodexAuthInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAccountJsonImport, setPendingAccountJsonImport] = useState<PendingAccountJsonImport | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [oauthEmailHint, setOauthEmailHint] = useState("");
  const [oauthSession, setOauthSession] = useState<OAuthLoginStartResponse | null>(null);
  const [oauthCallbackInput, setOauthCallbackInput] = useState("");
  const [oauthStarting, setOauthStarting] = useState(false);

  const txtInputRef = useRef<HTMLInputElement | null>(null);
  const accountJsonInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setMethod("menu");
    setTokenInput("");
    setSessionInput("");
    setCodexAuthInput("");
    setPendingAccountJsonImport(null);
    setConfirmOpen(false);
    setOauthEmailHint("");
    setOauthSession(null);
    setOauthCallbackInput("");
    setOauthStarting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const submitTokens = async (tokens: string[], successText?: string, accountPayloads: AccountImportPayload[] = []) => {
    const normalizedTokens = tokens.map((item) => item.trim()).filter(Boolean);

    if (normalizedTokens.length === 0) {
      toast.error("Trước tiên, vui lòng cung cấp ít nhất một Token có sẵn");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createAccounts(normalizedTokens, accountPayloads);
      onImported(data.items);
      setOpen(false);
      resetState();

      if ((data.errors?.length ?? 0) > 0) {
        const firstError = data.errors?.[0]?.error;
        toast.error(
          `${successText ?? "Đã nhập xong"}，Mới ${data.added ?? 0} một，Đã làm mới ${data.refreshed ?? 0} một，thất bại ${data.errors?.length ?? 0} một${firstError ? `, lỗi đầu tiên: ${firstError}` : ""}`,
        );
      } else {
        toast.success(
          `${successText ?? "Đã nhập xong"}，Mới ${data.added ?? 0} một，bỏ qua ${data.skipped ?? 0} trùng lặp，Thông tin tài khoản đã được tự động làm mới`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể nhập tài khoản";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportTokenText = async () => {
    await submitTokens(splitTokens(tokenInput), "Đã hoàn tất nhập token truy cập");
  };

  // Từ ủy quyền：lấy authorize URL，Mở ngay trong cửa sổ mới，Thuận tiện cho người dùng đăng nhập
  const handleStartOAuth = async () => {
    setOauthStarting(true);
    try {
      const data = await startOAuthLogin(oauthEmailHint.trim());
      setOauthSession(data);
      setOauthCallbackInput("");
      if (typeof window !== "undefined") {
        window.open(data.authorize_url, "_blank", "noopener,noreferrer");
      }
      toast.success("Trang ủy quyền OpenAI đã được mở. Vui lòng sao chép lại URL gọi lại sau khi đăng nhập.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Khởi tạo OAuth không thành công";
      toast.error(message);
    } finally {
      setOauthStarting(false);
    }
  };

  // dán lại callback URL Hoàn tất trao đổi token + Đặt hàng
  const handleFinishOAuth = async () => {
    if (!oauthSession) {
      toast.error("Vui lòng nhấp vào trước\"Mở trang ủy quyền\"Nhận phiên");
      return;
    }
    const trimmed = oauthCallbackInput.trim();
    if (!trimmed) {
      toast.error("Vui lòng dán URL hoặc mã gọi lại");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await finishOAuthLogin(oauthSession.session_id, trimmed);
      onImported(data.items);
      setOpen(false);
      resetState();

      if ((data.errors?.length ?? 0) > 0) {
        const firstError = data.errors?.[0]?.error;
        toast.error(
          `Đăng nhập OAuth đã hoàn tất, ${data.added ?? 0} mới, ${data.refreshed ?? 0} được làm mới, không thành công ${data.errors?.length ?? 0} ${firstError? `, lỗi đầu tiên: ${firstError}` : ""}`,
        );
      } else {
        toast.success(
          `Đăng nhập OAuth đã hoàn tất, ${data.added ?? 0} đã thêm, ${data.skipped ?? 0} bản sao bị bỏ qua, thông tin tài khoản đã được tự động làm mới`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Thay thế token OAuth không thành công";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sao chép authorize URL vào khay nhớ tạm（Thích ứng với trình duyệt và fallback）
  const handleCopyAuthorizeUrl = async () => {
    if (!oauthSession) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(oauthSession.authorize_url);
        toast.success("Đã sao chép URL ủy quyền vào bảng nhớ tạm");
      } else {
        toast.error("Môi trường hiện tại không hỗ trợ sao chép tự động, vui lòng chọn và sao chép thủ công.");
      }
    } catch {
      toast.error("Sao chép không thành công, vui lòng chọn và sao chép thủ công");
    }
  };

  const handleTxtSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const content = await readFileAsText(file);
      const tokens = splitTokens(content);

      if (tokens.length === 0) {
        toast.error("Không có Token hợp lệ nào được đọc trong tệp TXT.");
        return;
      }

      setTokenInput((prev) => {
        const next = [...splitTokens(prev), ...tokens];
        return next.join("\n");
      });
      toast.success(`Đọc token ${file.name} từ ${tokens.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không đọc được tệp TXT";
      toast.error(message);
    }
  };

  const handleImportSessionJson = async () => {
    if (!sessionInput.trim()) {
      toast.error("Trước tiên, vui lòng dán JSON phiên hoàn chỉnh");
      return;
    }

    try {
      const payload = JSON.parse(sessionInput) as unknown;
      const token = getSessionAccessToken(payload);

      if (!token) {
        toast.error("accessToken không được trích xuất từ JSON phiên");
        return;
      }

      await submitTokens([token], "Quá trình nhập JSON của phiên đã hoàn tất");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Phân tích cú pháp JSON của phiên không thành công";
      toast.error(message);
    }
  };

  const handleImportCodexAuthJson = async () => {
    if (!codexAuthInput.trim()) {
      toast.error("Trước tiên hãy dán JSON xác thực Codex");
      return;
    }

    try {
      const payload = JSON.parse(codexAuthInput) as unknown;
      const account = getCodexAuthAccount(payload);

      if (!account) {
        toast.error("access_token không được trích xuất từ JSON xác thực Codex");
        return;
      }

      await submitTokens([account.access_token], "Đã hoàn tất quá trình nhập JSON xác thực Codex", [account]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xác thực Codex Phân tích cú pháp JSON không thành công";
      toast.error(message);
    }
  };

  const handleAccountJsonSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    try {
      const results = await Promise.all(
        files.map(async (file) => {
          const raw = await readFileAsText(file);
          const parsed = JSON.parse(raw) as unknown;
          const accounts = getAccountJsonAccounts(parsed);
          return {
            accounts,
          };
        }),
      );

      const accounts = results.flatMap((item) => item.accounts);
      const tokens = accounts.map((item) => item.access_token);
      const parsedAccountCount = accounts.length;
      const errorCount = results.filter((item) => item.accounts.length === 0).length;

      if (parsedAccountCount === 0) {
        toast.error("Không đọc được access_token hợp lệ nào từ các tệp JSON tài khoản này");
        return;
      }

      setPendingAccountJsonImport({
        tokens,
        accounts,
        parsedAccountCount,
        errorCount,
      });
      setConfirmOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Đọc tệp JSON tài khoản thất bại";
      toast.error(message);
    }
  };

  const renderMethodBody = () => {
    if (method === "token") {
      const tokenCount = splitTokens(tokenInput).length;

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMethod("menu")}
              className="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-stone-800"
            >
              <ArrowLeft className="size-4" />
              Quay lại chế độ nhập
            </button>
            <span className="text-xs text-stone-400">nhận dạng hiện tại {tokenCount} một Token</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Danh sách token truy cập</label>
            <Textarea
              placeholder="Một token truy cập trên mỗi dòng..."
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              className="min-h-56 resize-none rounded-xl border-stone-200"
            />
          </div>
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-stone-800">Nhập từ tệp TXT</div>
                <div className="text-sm leading-6 text-stone-500">Hỗ trợ `.txt` và nội dung tệp cũng là một Token trên mỗi dòng.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-stone-200 bg-white"
                onClick={() => txtInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <FileText className="size-4" />
                chọn TXT
              </Button>
            </div>
          </div>
          <input
            ref={txtInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(event) => void handleTxtSelected(event)}
          />
        </div>
      );
    }

    if (method === "session") {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMethod("menu")}
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-stone-800"
          >
            <ArrowLeft className="size-4" />
            Quay lại chế độ nhập
          </button>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
            mở
            {" "}
            <a
              href={sessionUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-stone-900 underline underline-offset-4"
            >
              {sessionUrl}
              <ExternalLink className="size-3.5" />
            </a>
            ，Sao chép toàn bộ trang trả lại JSON，Hệ thống sẽ tự động trích xuất `accessToken` nhập。
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <div className="font-medium">Cảnh báo rủi ro</div>
            <div>
              Đừng sử dụng tài khoản chính，Cố gắng sử dụng tài khoản phụ (clone) để nhập，Tránh nguy cơ bị cấm tài khoản。Dự án này không chịu bất kỳ trách nhiệm nào về rủi ro đóng tài khoản。
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Session JSON</label>
            <Textarea
              placeholder='Dán hoàn tất JSON，Ví dụ có chứa &quot;accessToken&quot; đối tượng...'
              value={sessionInput}
              onChange={(event) => setSessionInput(event.target.value)}
              className="min-h-56 resize-none rounded-xl border-stone-200 font-mono text-xs"
            />
          </div>
        </div>
      );
    }

    if (method === "oauth") {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMethod("menu")}
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-stone-800"
          >
            <ArrowLeft className="size-4" />
            Quay lại chế độ nhập
          </button>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600 space-y-2">
            <div className="font-medium text-stone-800">Các bước thao tác</div>
            <ol className="list-decimal pl-5 space-y-1">
              <li>(Tùy chọn) Điền địa chỉ email tài khoản ChatGPT của bạn và trang đăng nhập sẽ được điền sẵn.</li>
              <li>Nhấp vào &quot;Mở trang ủy quyền&quot; bên dưới và đăng nhập vào tài khoản ChatGPT của bạn trong tab mới.</li>
              <li>Sau khi đăng nhập, trình duyệt sẽ chuyển tới <code className="rounded bg-stone-200 px-1">platform.openai.com/auth/callback?code=...</code>. Sao chép ngay toàn bộ URL từ thanh địa chỉ (hoặc mở F12 để lấy dòng gọi lại trong Mạng và nhấp chuột phải vào Sao chép → Sao chép URL).</li>
              <li>Dán URL gọi lại vào hộp nhập bên dưới và nhấp vào &quot;Hoàn tất nhập&quot;.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Email (tùy chọn điền trước)</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={oauthEmailHint}
              onChange={(event) => setOauthEmailHint(event.target.value)}
              disabled={Boolean(oauthSession) || oauthStarting}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
            />
          </div>
          {!oauthSession ? (
            <Button
              type="button"
              className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
              onClick={() => void handleStartOAuth()}
              disabled={oauthStarting}
            >
              {oauthStarting ? <LoaderCircle className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Mở trang ủy quyền
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-3 text-xs leading-6 text-stone-600 break-all font-mono">
                {oauthSession.authorize_url}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-stone-200 bg-white"
                  onClick={() => void handleCopyAuthorizeUrl()}
                >
                  <Copy className="size-4" />
                  sao chép ủy quyền URL
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-stone-200 bg-white"
                  onClick={() => window.open(oauthSession.authorize_url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="size-4" />
                  Mở lại
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-stone-200 bg-white"
                  onClick={() => {
                    setOauthSession(null);
                    setOauthCallbackInput("");
                  }}
                >
                  tái sinh
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Dán URL gọi lại (hoặc chỉ mã)</label>
                <Textarea
                  placeholder={"https://platform.openai.com/auth/callback?code=...&state=..."}
                  value={oauthCallbackInput}
                  onChange={(event) => setOauthCallbackInput(event.target.value)}
                  className="min-h-24 resize-none rounded-xl border-stone-200 font-mono text-xs"
                />
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <div className="font-medium">Lưu ý</div>
            <div>
              Mã ủy quyền（code）Chỉ có thể được sử dụng một lần。Nếu trình duyệt của callback Tải trang hoàn tất、Đã hiển thị OpenAI trang lỗi，Đó code Nhiều khả năng nó đã được tiêu thụ，
              Xin vui lòng bấm vào &quot;tái sinh&quot; chạy lại。Toàn bộ quá trình nằm trong 10 Có thể hoàn thành trong vòng vài phút。
            </div>
          </div>
        </div>
      );
    }

    if (method === "account-json") {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMethod("menu")}
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-stone-800"
          >
            <ArrowLeft className="size-4" />
            Quay lại chế độ nhập
          </button>
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5">
            <div className="space-y-2">
              <div className="text-sm font-medium text-stone-800">Chọn tệp JSON tài khoản cục bộ</div>
              <div className="text-sm leading-6 text-stone-500">
                Hỗ trợ đối tượng tài khoản đơn hoặc mảng tất cả tài khoản được xuất từ dự án này, cũng tương thích với JSON CPA với mỗi tệp chứa một đối tượng tài khoản. Hệ thống sẽ tự động trích xuất `access_token` hoặc `accessToken`.
              </div>
            </div>
            <Button
              type="button"
              className="mt-4 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
              onClick={() => accountJsonInputRef.current?.click()}
              disabled={isSubmitting}
            >
              <Files className="size-4" />
              Chọn tệp JSON
            </Button>
          </div>
          <input
            ref={accountJsonInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={(event) => void handleAccountJsonSelected(event)}
          />
          {pendingAccountJsonImport ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
              Đọc lần cuối {pendingAccountJsonImport.parsedAccountCount} Token
              {pendingAccountJsonImport.errorCount > 0 ? `, thêm ${pendingAccountJsonImport.errorCount} tệp không trích xuất thành công.` : ""}。
            </div>
          ) : null}
        </div>
      );
    }

    if (method === "codex-auth") {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMethod("menu")}
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-stone-800"
          >
            <ArrowLeft className="size-4" />
            Quay lại chế độ nhập
          </button>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Xác thực Codex JSON</label>
            <Textarea
              placeholder='Dán chứa "access_token"、"refresh_token"、"id_token" của Xác thực Codex JSON...'
              value={codexAuthInput}
              onChange={(event) => setCodexAuthInput(event.target.value)}
              className="min-h-64 resize-none rounded-xl border-stone-200 font-mono text-xs"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <MethodCard
          title="Đăng nhập OAuth vào tài khoản hiện có (với tính năng làm mới tự động)"
          description="Sử dụng trình duyệt để đăng nhập vào tài khoản ChatGPT của bạn và điền URL gọi lại để nhận Refresh_token, URL này sẽ tự động được gia hạn trong nền."
          icon={LogIn}
          onClick={() => setMethod("oauth")}
        />
        <MethodCard
          title="Nhập token truy cập"
          description="Hỗ trợ dán trực tiếp, mỗi dòng một cái; cũng hỗ trợ đọc từ các tệp TXT, mỗi tệp một dòng."
          icon={KeyRound}
          onClick={() => setMethod("token")}
        />
        <MethodCard
          title="Nhập phiên JSON"
          description="Sao chép JSON hoàn chỉnh từ API session của chatgpt.com và tự động trích xuất accessToken."
          icon={FileJson}
          onClick={() => setMethod("session")}
        />
        <MethodCard
          title="Nhập JSON xác thực Codex"
          description="Dán JSON xác thực Codex. Sau khi nhập, nguồn tài khoản được đánh dấu là codex."
          icon={FileJson}
          onClick={() => setMethod("codex-auth")}
        />
        <MethodCard
          title="Nhập tệp JSON tài khoản"
          description="Hỗ trợ đối tượng tài khoản đơn hoặc mảng tất cả tài khoản được xuất từ dự án này, cũng tương thích với các tệp JSON CPA."
          icon={Files}
          onClick={() => setMethod("account-json")}
        />
        <MethodCard
          title="Nhập từ máy chủ CPA từ xa"
          description="Đi tới trang cài đặt để định cấu hình máy chủ CPA từ xa trước khi thực hiện nhập."
          icon={Files}
          onClick={() => {
            setOpen(false);
            resetState();
            router.push("/settings");
          }}
        />
        <MethodCard
          title="Nhập từ máy chủ Sub2API"
          description="Đi tới trang cài đặt để định cấu hình máy chủ Sub2API, sau đó chọn tài khoản OpenAI để nhập."
          icon={ServerCog}
          onClick={() => {
            setOpen(false);
            resetState();
            router.push("/settings");
          }}
        />
      </div>
    );
  };

  const footerDisabled = disabled || isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <Button
          className="h-10 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          <Upload className="size-4" />
          nhập
        </Button>
        <DialogContent showCloseButton={false} className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>
              {method === "menu"
                ? "Nhập tài khoản"
                : method === "token"
                  ? "Nhập token truy cập"
                  : method === "session"
                    ? "Nhập phiên JSON"
                    : method === "codex-auth"
                      ? "Nhập JSON xác thực Codex"
                    : method === "oauth"
                      ? "Đăng nhập OAuth vào tài khoản hiện có"
                      : "Nhập JSON tài khoản"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {method === "menu"
                ? "Chọn phương thức nhập. Sau khi nhập thành công, địa chỉ email, loại và hạn ngạch sẽ tự động được lấy."
                : method === "token"
                  ? "Hỗ trợ dán hoặc nhập thủ công từ tệp TXT, một Token trên mỗi dòng."
                  : method === "session"
                    ? "Dán JSON phiên hoàn chỉnh và hệ thống sẽ tự động trích xuất accessToken."
                    : method === "codex-auth"
                      ? "Dán JSON xác thực Codex và hệ thống sẽ nhập nó theo nguồn codex."
                    : method === "oauth"
                      ? "Sử dụng trình duyệt của bạn để chạy OAuth tiêu chuẩn OpenAI và hệ thống sẽ tự động gia hạn sau khi bạn lấy lại được Refresh_token."
                      : "Hỗ trợ đọc đối tượng tài khoản đơn hoặc mảng tất cả tài khoản, và xác nhận số lượng trước khi gửi."}
            </DialogDescription>
          </DialogHeader>

          {renderMethodBody()}

          <DialogFooter className="pt-2">
            <Button
              variant="secondary"
              className="h-10 rounded-xl bg-stone-100 px-5 text-stone-700 hover:bg-stone-200"
              onClick={() => setOpen(false)}
              disabled={footerDisabled}
            >
              Hủy bỏ
            </Button>
            {method === "token" ? (
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void handleImportTokenText()}
                disabled={footerDisabled}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                nhập Token
              </Button>
            ) : null}
            {method === "session" ? (
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void handleImportSessionJson()}
                disabled={footerDisabled}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                nhập JSON
              </Button>
            ) : null}
            {method === "codex-auth" ? (
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void handleImportCodexAuthJson()}
                disabled={footerDisabled}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                nhập JSON
              </Button>
            ) : null}
            {method === "oauth" ? (
              <Button
                className={cn(
                  "h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800",
                  !oauthSession ? "hidden" : "",
                )}
                onClick={() => void handleFinishOAuth()}
                disabled={footerDisabled || !oauthSession || !oauthCallbackInput.trim()}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Nhập hoàn tất
              </Button>
            ) : null}
            {method === "account-json" ? (
              <Button
                className={cn(
                  "h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800",
                  !pendingAccountJsonImport ? "hidden" : "",
                )}
                onClick={() => setConfirmOpen(true)}
                disabled={footerDisabled || !pendingAccountJsonImport}
              >
                Xem xác nhận nhập
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>Xác nhận nhập token tài khoản</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {pendingAccountJsonImport
                ? `Xác nhận rằng Token ${pendingAccountJsonImport.parsedAccountCount} đã được xác định. Bạn có muốn xác nhận việc nhập không?`
                : "Chưa có token có thể nhập nào được đọc."}
              {pendingAccountJsonImport?.errorCount
                ? `và các tệp ${pendingAccountJsonImport.errorCount} không được giải nén thành công.`
                : "。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="secondary"
              className="h-10 rounded-xl bg-stone-100 px-5 text-stone-700 hover:bg-stone-200"
              onClick={() => setConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Trở lại
            </Button>
            <Button
              className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
              onClick={() =>
                void submitTokens(
                  pendingAccountJsonImport?.tokens ?? [],
                  "Đã hoàn tất quá trình nhập JSON tài khoản",
                  pendingAccountJsonImport?.accounts ?? [],
                )
              }
              disabled={isSubmitting || !pendingAccountJsonImport}
            >
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Xác nhận nhập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
