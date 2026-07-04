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

function splittokenss(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSessionAccesstokens(value: unknown) {
  const token = (value as { accesstokens?: unknown })?.accesstokens;
  return typeof token === "string" ? token.trim() : "";
}

function getAccountJsonAccount(value: unknown): AccountImportPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const tokenValue = raw.access_token ?? raw.accesstokens;
  const token = typeof tokenValue === "string" ? tokenValue.trim() : "";
  if (!token) {
    return null;
  }

  const payload: AccountImportPayload = {
    ...raw,
    access_token: token,
    source_type: "codex",
  };
  delete payload.accesstokens;
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
  const tokenValue = raw.access_token ?? raw.accesstokens;
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
  delete payload.accesstokens;
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
  const [tokenInput, settokensInput] = useState("");
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
    settokensInput("");
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

  const submittokenss = async (tokens: string[], successText?: string, accountPayloads: AccountImportPayload[] = []) => {
    const normalizedtokenss = tokens.map((item) => item.trim()).filter(Boolean);

    if (normalizedtokenss.length === 0) {
      toast.error("Trước tiên, vui lòng cung cấp ít nhất một tokens có sẵn");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createAccounts(normalizedtokenss, accountPayloads);
      onImported(data.items);
      setOpen(false);
      resetState();

      if ((data.errors?.length ?? 0) > 0) {
        const firstError = data.errors?.[0]?.error;
        toast.error(
          `${successText ?? "Đã nhập xong"}，Mới ${data.added ?? 0} một，Đã làm mới ${data.refreshed ?? 0} một，thất bại ${data.errors?.length ?? 0} một${firstError ? `, first error: ${firstError}` : ""}`,
        );
      } else {
        toast.success(
          `${successText ?? "Đã nhập xong"}，Mới ${data.added ?? 0} một，skip ${data.skipped ?? 0} trùng lặp，Thông tin accounts đã được tự động làm mới`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể nhập accounts";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImporttokensText = async () => {
    await submittokenss(splittokenss(tokenInput), "Đã hoàn tất nhập token truy cập");
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

  // dán lại callback URL Done trao đổi token + Đặt hàng
  const handleFinishOAuth = async () => {
    if (!oauthSession) {
      toast.error("Vui lòng nhấp vào trước\"Open authorization page\"Nhận phiên");
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
          `Login OAuth đã hoàn tất, ${data.added ?? 0} mới, ${data.refreshed ?? 0} được làm mới, không thành công ${data.errors?.length ?? 0} ${firstError? `, first error: ${firstError}` : ""}`,
        );
      } else {
        toast.success(
          `Login OAuth đã hoàn tất, ${data.added ?? 0} đã additional, ${data.skipped ?? 0} bản sao bị skip, thông tin accounts đã được tự động làm mới`,
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
      const tokens = splittokenss(content);

      if (tokens.length === 0) {
        toast.error("Không có tokens hợp lệ nào được đọc trong tệp TXT.");
        return;
      }

      settokensInput((prev) => {
        const next = [...splittokenss(prev), ...tokens];
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
      const token = getSessionAccesstokens(payload);

      if (!token) {
        toast.error("accesstokens không được trích xuất từ JSON phiên");
        return;
      }

      await submittokenss([token], "Quá trình nhập JSON của phiên đã hoàn tất");
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

      await submittokenss([account.access_token], "Đã hoàn tất quá trình nhập JSON xác thực Codex", [account]);
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
        toast.error("No valid access token found in these account JSON files.");
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
      const message = error instanceof Error ? error.message : "Failed to read account JSON files.";
      toast.error(message);
    }
  };

  const renderMethodBody = () => {
    if (method === "token") {
      const tokenCount = splittokenss(tokenInput).length;

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMethod("menu")}
              className="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-stone-800"
            >
              <ArrowLeft className="size-4" />
              Back to import mode
            </button>
            <span className="text-xs text-stone-400">currently identified {tokenCount} tokens</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Access Token List</label>
            <Textarea
              placeholder="One access token per line..."
              value={tokenInput}
              onChange={(event) => settokensInput(event.target.value)}
              className="min-h-56 resize-none rounded-xl border-stone-200"
            />
          </div>
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-stone-800">Import from TXT file</div>
                <div className="text-sm leading-6 text-stone-500">Supports `.txt` files with one token per line.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-stone-200 bg-white"
                onClick={() => txtInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <FileText className="size-4" />
                Select TXT
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
            Back to import mode
          </button>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
            Open
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
            , copy the entire JSON returned on the page, and the system will automatically extract access tokens for import.
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <div className="font-medium">Risk Warning</div>
            <div>
              Do not use your main account. Try to use secondary accounts (clones) to import to avoid account bans. This project does not assume any responsibility for the risk of account closures.
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Session JSON</label>
            <Textarea
              placeholder='Paste the complete JSON containing "accessToken" or similar properties...'
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
            Back to import mode
          </button>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600 space-y-2">
            <div className="font-medium text-stone-800">Steps</div>
            <ol className="list-decimal pl-5 space-y-1">
              <li>(Optional) Fill in your ChatGPT account email, and the login page will be pre-filled.</li>
              <li>Click &quot;Open authorization page&quot; below and log in to your ChatGPT account in a new tab.</li>
              <li>After logging in, the browser will redirect to <code className="rounded bg-stone-200 px-1">platform.openai.com/auth/callback?code=...</code>. Copy the entire URL from the address bar immediately (or open F12 to get the callback line in the Network tab, right-click, and click Copy → Copy URL).</li>
              <li>Paste the callback URL in the input box below and click &quot;Complete Import&quot;.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Email (optional pre-fill)</label>
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
              Open authorization page
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
                  Copy authorization URL
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-stone-200 bg-white"
                  onClick={() => window.open(oauthSession.authorize_url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="size-4" />
                  Reopen
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
                  Regenerate
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Paste callback URL (or just code)</label>
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
            <div className="font-medium">Note</div>
            <div>
              The authorization code can only be used once. If the callback page finishes loading or shows an OpenAI error page, the code has likely already been consumed.
              Please click &quot;Regenerate&quot; to try again. The entire process can be completed within 10 minutes.
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
            Back to import mode
          </button>
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5">
            <div className="space-y-2">
              <div className="text-sm font-medium text-stone-800">Select local account JSON file</div>
              <div className="text-sm leading-6 text-stone-500">
                Supports single account objects or arrays of all accounts exported from this project, also compatible with CPA JSON files with one account object each. The system will automatically extract `access_token` or `accesstokens`.
              </div>
            </div>
            <Button
              type="button"
              className="mt-4 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
              onClick={() => accountJsonInputRef.current?.click()}
              disabled={isSubmitting}
            >
              <Files className="size-4" />
              Select JSON file
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
              Last read {pendingAccountJsonImport.parsedAccountCount} tokens
              {pendingAccountJsonImport.errorCount > 0 ? `, additional ${pendingAccountJsonImport.errorCount} files failed to extract successfully.` : ""}.
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
            Back to import mode
          </button>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Codex Auth JSON</label>
            <Textarea
              placeholder='Paste Codex Auth JSON containing "access_token", "refresh_token", "id_token"...'
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
          title="OAuth login to existing account (with auto-refresh)"
          description="Use your browser to log in to your ChatGPT account and fill in the callback URL to get the Refresh_token, which will be auto-renewed in the background."
          icon={LogIn}
          onClick={() => setMethod("oauth")}
        />
        <MethodCard
          title="Import Access tokenss"
          description="Supports direct pasting, one per line; also supports reading from TXT files, one per line."
          icon={KeyRound}
          onClick={() => setMethod("token")}
        />
        <MethodCard
          title="Import JSON Session"
          description="Copy complete JSON from session API of chatgpt.com to automatically extract access tokens."
          icon={FileJson}
          onClick={() => setMethod("session")}
        />
        <MethodCard
          title="Import Codex Auth JSON"
          description="Paste the Codex authentication JSON. Once imported, the account source will be marked as codex."
          icon={FileJson}
          onClick={() => setMethod("codex-auth")}
        />
        <MethodCard
          title="Import Account JSON File"
          description="Supports single account objects or arrays of all accounts exported from this project, also compatible with CPA JSON files."
          icon={Files}
          onClick={() => setMethod("account-json")}
        />
        <MethodCard
          title="Import from remote CPA server"
          description="Go to settings page to configure remote CPA server before importing."
          icon={Files}
          onClick={() => {
            setOpen(false);
            resetState();
            router.push("/settings");
          }}
        />
        <MethodCard
          title="Import from Sub2API server"
          description="Go to settings page to configure Sub2API server, then select OpenAI accounts to import."
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
          Import
        </Button>
        <DialogContent showCloseButton={false} className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>
              {method === "menu"
                ? "Import Accounts"
                : method === "token"
                  ? "Import Access tokenss"
                  : method === "session"
                    ? "Import JSON Session"
                    : method === "codex-auth"
                      ? "Import Codex Auth JSON"
                    : method === "oauth"
                      ? "OAuth login to existing account"
                      : "Import Account JSON"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {method === "menu"
                ? "Select the import method. After successful import, the email address, type, and quota will be automatically retrieved."
                : method === "token"
                  ? "Supports pasting or manually importing from TXT files, one token per line."
                  : method === "session"
                    ? "Paste complete session JSON, and the system will automatically extract accesstokens."
                    : method === "codex-auth"
                      ? "Paste Codex Auth JSON, and the system will import it under codex source."
                    : method === "oauth"
                      ? "Use your browser to run standard OpenAI OAuth, and the system will automatically renew after retrieving the Refresh_token."
                      : "Supports reading single account objects or arrays of all accounts, and confirming the quantity before submitting."}
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
              Cancel
            </Button>
            {method === "token" ? (
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void handleImporttokensText()}
                disabled={footerDisabled}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Import Tokens
              </Button>
            ) : null}
            {method === "session" ? (
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void handleImportSessionJson()}
                disabled={footerDisabled}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Import JSON
              </Button>
            ) : null}
            {method === "codex-auth" ? (
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void handleImportCodexAuthJson()}
                disabled={footerDisabled}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Import JSON
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
                Complete Import
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
                Confirm Import
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>Confirm Importing Accounts</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {pendingAccountJsonImport
                ? `Confirm that ${pendingAccountJsonImport.parsedAccountCount} tokens have been identified. Do you want to proceed with the import?`
                : "No importable tokens were read."}
              {pendingAccountJsonImport?.errorCount
                ? ` and ${pendingAccountJsonImport.errorCount} files failed to extract successfully.`
                : "."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="secondary"
              className="h-10 rounded-xl bg-stone-100 px-5 text-stone-700 hover:bg-stone-200"
              onClick={() => setConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
              onClick={() =>
                void submittokenss(
                  pendingAccountJsonImport?.tokens ?? [],
                  "JSON account import complete",
                  pendingAccountJsonImport?.accounts ?? [],
                )
              }
              disabled={isSubmitting || !pendingAccountJsonImport}
            >
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
