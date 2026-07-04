"use client";

import { AlertTriangle, LoaderCircle, Plus, Play, RotateCcw, Save, Square, Trash2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useSettingsStore } from "../../settings/store";

export function RegisterCard() {
  const config = useSettingsStore((state) => state.registerConfig);
  const isLoading = useSettingsStore((state) => state.isLoadingRegister);
  const isSaving = useSettingsStore((state) => state.isSavingRegister);
  const setProxy = useSettingsStore((state) => state.setRegisterProxy);
  const setProxyRotatingEnabled = useSettingsStore((state) => state.setRegisterProxyRotatingEnabled);
  const setProxyRotatingKeysText = useSettingsStore((state) => state.setRegisterProxyRotatingKeysText);
  const setTotal = useSettingsStore((state) => state.setRegisterTotal);
  const setThreads = useSettingsStore((state) => state.setRegisterThreads);
  const setMode = useSettingsStore((state) => state.setRegisterMode);
  const setTargetQuota = useSettingsStore((state) => state.setRegisterTargetQuota);
  const setTargetAvailable = useSettingsStore((state) => state.setRegisterTargetAvailable);
  const setCheckInterval = useSettingsStore((state) => state.setRegisterCheckInterval);
  const setMailField = useSettingsStore((state) => state.setRegisterMailField);
  const setMailApiUseRegisterProxy = useSettingsStore((state) => state.setRegisterMailApiUseRegisterProxy);
  const addProvider = useSettingsStore((state) => state.addRegisterProvider);
  const updateProvider = useSettingsStore((state) => state.updateRegisterProvider);
  const deleteProvider = useSettingsStore((state) => state.deleteRegisterProvider);
  const save = useSettingsStore((state) => state.saveRegister);
  const toggle = useSettingsStore((state) => state.toggleRegister);
  const reset = useSettingsStore((state) => state.resetRegister);
  const resetOutlookPool = useSettingsStore((state) => state.resetOutlookPool);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-white/80 p-10">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!config) return null;

  const stats = config.stats || { success: 0, fail: 0, done: 0, running: 0, threads: config.threads };
  const providers = config.mail.providers || [];
  const logs = config.logs || [];
  const updateProviderType = (index: number, type: string) => {
    updateProvider(index, {
      type,
      enable: true,
      ...(type === "cloudmail_gen" ? { api_base: "", admin_email: "", admin_password: "", domain: [], subdomain: [], email_prefix: "" } : {}),
      ...(type === "cloudflare_temp_email" ? { api_base: "", admin_password: "", domain: [] } : {}),
      ...(type === "tempmail_lol" ? { api_key: "", domain: [] } : {}),
      ...(type === "moemail" ? { api_base: "", api_key: "", domain: [] } : {}),
      ...(type === "inbucket" ? { api_base: "", domain: [], random_subdomain: true } : {}),
      ...(type === "duckmail" ? { api_key: "", default_domain: "duckmail.sbs" } : {}),
      ...(type === "gptmail" ? { api_key: "", default_domain: "" } : {}),
      ...(type === "yyds_mail" ? { api_base: "https://maliapi.215.im/v1", api_key: "", domain: [], subdomain: "", wildcard: false } : {}),
      ...(type === "ddg_mail" ? { ddg_token: "", cf_inbox_jwt: "", cf_domain: [], admin_password: "" } : {}),
      ...(type === "outlook_token" ? { mailboxes: "", mode: "graph", imap_host: "outlook.office365.com", message_limit: 10 } : {}),
    });
  };

  return (
    <div className="grid h-[calc(100vh-132px)] min-h-[640px] items-stretch gap-0 overflow-hidden rounded-xl border border-stone-200 bg-white/70 xl:grid-cols-2">
      <section className="space-y-4 overflow-y-auto border-b border-stone-200 p-4 xl:border-r xl:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-stone-100">
                <UserPlus className="size-5 text-stone-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Đăng ký cấu hình</h2>
              </div>
            </div>
            <Button className="h-9 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800" onClick={() => void save()} disabled={isSaving || config.enabled}>
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              Lưu cấu hình
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Nếu việc chặn Cloudflare xuất hiện trong nhật ký đăng ký, bạn có thể bật FlareSolverr vượt Cloudflare trên trang cài đặt; vùng chứa Docker có liên quan cần được khởi động trước.</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-stone-700">Chế độ đăng ký</label>
              <Select value={config.mode || "total"} onValueChange={(value) => setMode(value as "total" | "quota" | "available")} disabled={config.enabled}>
                <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Tổng số đăng ký</SelectItem>
                  <SelectItem value="quota">Hạn ngạch còn lại của nhóm số</SelectItem>
                  <SelectItem value="available">Số lượng tài khoản có sẵn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-stone-700">Tổng số đăng ký</label>
              <Input value={String(config.total)} onChange={(event) => setTotal(event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled || config.mode !== "total"} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-stone-700">Số lượng chủ đề</label>
              <Input value={String(config.threads)} onChange={(event) => setThreads(event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-stone-700">proxy đã đăng ký (Cố định)</label>
              <Input value={config.proxy} onChange={(event) => setProxy(event.target.value)} placeholder="http://127.0.0.1:7890" className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled || config.proxy_rotating_enabled} />
            </div>
            <div className="space-y-2 flex items-center pt-6">
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <Checkbox checked={Boolean(config.proxy_rotating_enabled)} onCheckedChange={(checked) => setProxyRotatingEnabled(Boolean(checked))} disabled={config.enabled} />
                Bật proxy xoay (proxyxoay.org/shop)
              </label>
            </div>
            <div className="hidden md:block" />
            {config.proxy_rotating_enabled && (
              <div className="space-y-2 col-span-3">
                <label className="text-sm text-stone-700">API Key proxy xoay (Mỗi dòng một khóa)</label>
                <Textarea
                  value={config.proxy_rotating_keys ? config.proxy_rotating_keys.join("\n") : ""}
                  onChange={(event) => setProxyRotatingKeysText(event.target.value)}
                  placeholder="Nhập danh sách API Key, mỗi dòng một khóa..."
                  className="min-h-24 rounded-xl border-stone-200 bg-white font-mono text-xs"
                  disabled={config.enabled}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm text-stone-700">mục tiêu số dư còn lại</label>
              <Input value={String(config.target_quota || "")} onChange={(event) => setTargetQuota(event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled || config.mode !== "quota"} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-stone-700">Nhắm mục tiêu các tài khoản có sẵn</label>
              <Input value={String(config.target_available || "")} onChange={(event) => setTargetAvailable(event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled || config.mode !== "available"} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-stone-700">Khoảng thời gian kiểm tra (giây)</label>
              <Input value={String(config.check_interval || "")} onChange={(event) => setCheckInterval(event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled || config.mode === "total"} />
            </div>
          </div>

          <div className="space-y-3 border-t border-stone-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-800">Cấu hình email</h3>
                <p className="mt-1 text-xs text-stone-500">Nhiều nhà cung cấp có thể được cấu hình và luân chuyển theo thứ tự kích hoạt.</p>
              </div>
              <Button type="button" variant="outline" className="h-9 rounded-xl border-stone-200 bg-white px-3 text-stone-700" onClick={addProvider} disabled={config.enabled}>
                <Plus className="size-4" />
                thêm
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Yêu cầu hết thời gian</label>
                <Input value={String(config.mail.request_timeout || "")} onChange={(event) => setMailField("request_timeout", event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Hết thời gian chờ mã xác minh</label>
                <Input value={String(config.mail.wait_timeout || "")} onChange={(event) => setMailField("wait_timeout", event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Khoảng thời gian bỏ phiếu</label>
                <Input value={String(config.mail.wait_interval || "")} onChange={(event) => setMailField("wait_interval", event.target.value)} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <Checkbox
                checked={Boolean(config.mail.api_use_register_proxy)}
                onCheckedChange={(checked) => setMailApiUseRegisterProxy(Boolean(checked))}
                disabled={config.enabled}
              />
              <div className="space-y-1">
                <span className="text-sm font-medium text-stone-700">Sử dụng proxy đăng ký cho yêu cầu email</span>
                <p className="text-xs text-stone-500">Sau khi mở, các yêu cầu nhận email xác minh từ các nhà cung cấp sẽ đi qua proxy đăng ký đã được định cấu hình.</p>
              </div>
            </div>

            <div className="space-y-3">
              {providers.map((provider, index) => {
                const type = String(provider.type || "tempmail_lol");
                const domains = Array.isArray(provider.domain) ? provider.domain.map(String).join("\n") : "";
                const subdomains = Array.isArray(provider.subdomain) ? provider.subdomain.map(String).join("\n") : "";
                return (
                  <div key={index} className="space-y-3 border-t border-stone-200 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm text-stone-700">
                        <Checkbox checked={Boolean(provider.enable)} onCheckedChange={(checked) => updateProvider(index, { enable: Boolean(checked) })} disabled={config.enabled} />
                        kích hoạt
                      </label>
                      <button type="button" className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50" onClick={() => deleteProvider(index)} disabled={config.enabled || providers.length <= 1} title="Xóa nhà cung cấp">
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm text-stone-700">loại</label>
                        <Select value={type} onValueChange={(value) => updateProviderType(index, value)} disabled={config.enabled}>
                          <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cloudmail_gen">cloudmail_gen</SelectItem>
                            <SelectItem value="cloudflare_temp_email">cloudflare_temp_email</SelectItem>
                            <SelectItem value="tempmail_lol">tempmail_lol</SelectItem>
                            <SelectItem value="moemail">moemail</SelectItem>
                            <SelectItem value="inbucket">inbucket_mail</SelectItem>
                            <SelectItem value="duckmail">duckmail</SelectItem>
                            <SelectItem value="gptmail">gptmail (chưa được kiểm tra)</SelectItem>
                            <SelectItem value="yyds_mail">yyds_mail</SelectItem>
                            <SelectItem value="ddg_mail">ddg_mail (Hộp thư DDG + chuyển CF)</SelectItem>
                            <SelectItem value="outlook_token">Outlook_token (Nhóm hộp thư Outlook/Hotmail)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {type === "cloudmail_gen" || type === "cloudflare_temp_email" || type === "moemail" || type === "inbucket" || type === "yyds_mail" || type === "ddg_mail" ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm text-stone-700">{type === "cloudmail_gen" ? "CloudMail URL" : "API Base"}</label>
                            <Input value={String(provider.api_base || "")} onChange={(event) => updateProvider(index, { api_base: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                          </div>
                          {type === "cloudmail_gen" ? (
                            <>
                              <div className="space-y-2">
                                <label className="text-sm text-stone-700">Email quản trị viên</label>
                                <Input value={String(provider.admin_email || "")} onChange={(event) => updateProvider(index, { admin_email: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm text-stone-700">Mật khẩu quản trị viên</label>
                                <Input value={String(provider.admin_password || "")} onChange={(event) => updateProvider(index, { admin_password: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                              </div>
                            </>
                          ) : null}
                          {type === "cloudflare_temp_email" || type === "ddg_mail" ? (
                            <div className="space-y-2">
                              <label className="text-sm text-stone-700">Admin Password</label>
                              <Input value={String(provider.admin_password || "")} onChange={(event) => updateProvider(index, { admin_password: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {type === "ddg_mail" ? (
                        <>
                        <div className="space-y-2">
                          <label className="text-sm text-stone-700">DDG Token <span className="text-red-400">*</span></label>
                          <Input value={String(provider.ddg_token || "")} onChange={(event) => updateProvider(index, { ddg_token: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} placeholder="Token mang để bảo vệ email DuckDuckGo" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-stone-700">CF Inbox JWT <span className="text-red-400">*</span></label>
                          <Input value={String(provider.cf_inbox_jwt || "")} onChange={(event) => updateProvider(index, { cf_inbox_jwt: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} placeholder="Đã sửa lỗi hộp thư đến JWT cho phần phụ trợ hộp thư tạm thời CF (mục tiêu chuyển tiếp DDG)" />
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          <p className="font-medium mb-1">Hướng dẫn sử dụng</p>
                          <ol className="list-decimal list-inside space-y-0.5">
                            <li>đầu tiên <a href="https://duckduckgo.com/email/" target="_blank" className="underline">DuckDuckGo Email Protection</a> Đăng nhập và đặt mục tiêu chuyển tiếp tới địa chỉ hộp thư đến CF</li>
                            <li>DDG Token được lấy từ trình duyệt DevTools → Network → yêu cầu quack.duckduckgo.com <code className="bg-amber-100 px-1 rounded">Authorization: Bearer</code></li>
                            <li>Hộp thư đến CF JWT Nhận được từ phần phụ trợ hộp thư tạm thời CF sau khi tạo hộp thư đến cố định</li>
                            <li>Tất cả các email mà bí danh @duck.com nhận được sẽ được chuyển tiếp đến cùng một hộp thư đến CF và hệ thống sẽ tự động đối sánh chúng dựa trên tiêu đề To:.</li>
                          </ol>
                        </div>
                        </>
                      ) : null}
                      {type === "inbucket" ? (
                        <label className="flex items-center gap-3 pt-8 text-sm text-stone-700">
                          <Checkbox checked={Boolean(provider.random_subdomain ?? true)} onCheckedChange={(checked) => updateProvider(index, { random_subdomain: Boolean(checked) })} disabled={config.enabled} />
                          Bật tên miền phụ ngẫu nhiên
                        </label>
                      ) : null}
                      {type === "tempmail_lol" || type === "moemail" || type === "duckmail" || type === "gptmail" || type === "yyds_mail" ? (
                        <div className="space-y-2">
                          <label className="text-sm text-stone-700">API Key</label>
                          <Input value={String(provider.api_key || "")} onChange={(event) => updateProvider(index, { api_key: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                        </div>
                      ) : null}
                      {type === "duckmail" || type === "gptmail" ? (
                        <div className="space-y-2">
                          <label className="text-sm text-stone-700">Default Domain</label>
                          <Input value={String(provider.default_domain || "")} onChange={(event) => updateProvider(index, { default_domain: event.target.value })} placeholder={type === "duckmail" ? "duckmail.sbs" : ""} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                        </div>
                      ) : null}
                      {type === "yyds_mail" ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm text-stone-700">Subdomain</label>
                            <Input value={String(provider.subdomain || "")} onChange={(event) => updateProvider(index, { subdomain: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                          </div>
                          <label className="flex items-center gap-3 pt-8 text-sm text-stone-700">
                            <Checkbox checked={Boolean(provider.wildcard)} onCheckedChange={(checked) => updateProvider(index, { wildcard: Boolean(checked) })} disabled={config.enabled} />
                            Wildcard
                          </label>
                        </>
                      ) : null}
                      {type === "outlook_token" ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm text-stone-700">Phương pháp đọc</label>
                            <Select value={String(provider.mode || "graph")} onValueChange={(value) => updateProvider(index, { mode: value })} disabled={config.enabled}>
                              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="graph">Graph API</SelectItem>
                                <SelectItem value="imap">IMAP (XOAUTH2)</SelectItem>
                                <SelectItem value="auto">Tự động (Biểu đồ→IMAP)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {String(provider.mode || "graph") !== "graph" ? (
                            <div className="space-y-2">
                              <label className="text-sm text-stone-700">IMAP Host</label>
                              <Input value={String(provider.imap_host || "outlook.office365.com")} onChange={(event) => updateProvider(index, { imap_host: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-white" disabled={config.enabled} />
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>

                    {type === "outlook_token" ? (() => {
                      const stats = (provider.mailboxes_stats || {}) as Record<string, number>;
                      const savedCount = Number(provider.mailboxes_count || 0);
                      const preview = Array.isArray(provider.mailboxes_preview) ? (provider.mailboxes_preview as string[]) : [];
                      const pendingCount = String(provider.mailboxes || "").split(/\r?\n/).filter((line) => line.includes("----") && line.split("----").length >= 4).length;
                      return (
                        <div className="space-y-2">
                          <label className="flex items-center justify-between text-sm text-stone-700">
                            <span>Nhập pool email <span className="text-red-400">*</span></span>
                            <span className="text-xs text-stone-400">đã lưu {savedCount} một{pendingCount ? ` · Các mục ${pendingCount} sẽ được nhập` : ""}</span>
                          </label>
                          <Textarea value={String(provider.mailboxes || "")} onChange={(event) => updateProvider(index, { mailboxes: event.target.value })} placeholder={"Một email trên mỗi dòng, định dạng:\nEmail----Mật khẩu----client_id----refresh_token\n(Vì lý do bảo mật, mật khẩu/refresh_token đã lưu sẽ không được lặp lại; mật khẩu này chỉ được sử dụng để thêm hoặc ghi đè)"} className="min-h-32 rounded-xl border-stone-200 bg-white font-mono text-xs" disabled={config.enabled} />
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">Không được sử dụng {stats.unused ?? 0}</span>
                            <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-600">chiếm đóng {stats.in_use ?? 0}</span>
                            <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">đã qua sử dụng {stats.used ?? 0}</span>
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">tokenkhông hợp lệ {stats.token_invalid ?? 0}</span>
                            <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-600">thất bại {stats.failed ?? 0}</span>
                          </div>
                          {preview.length ? (
                            <p className="text-xs text-stone-400">Địa chỉ email đã lưu (đã được giải mẫn cảm): {preview.slice(0, 8).join("、")}{preview.length > 8 ? ` Đợi ${preview.length}` : ""}</p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" className="h-8 rounded-lg border-stone-200 bg-white px-3 text-xs text-stone-700" onClick={() => void resetOutlookPool("failed")} disabled={config.enabled}>
                              Xóa không thành công/Tình trạng chiếm đóng
                            </Button>
                            <Button type="button" variant="outline" className="h-8 rounded-lg border-amber-200 bg-white px-3 text-xs text-amber-700 hover:bg-amber-50" onClick={() => { if (window.confirm("Bạn có chắc chắn muốn xóa tất cả các hộp thư không sử dụng khỏi pool email Outlook không? Hành động này sẽ xóa các thông tin xác thực đã lưu này.")) void resetOutlookPool("unused"); }} disabled={config.enabled}>
                              Xóa không sử dụng
                            </Button>
                            <Button type="button" variant="outline" className="h-8 rounded-lg border-rose-200 bg-white px-3 text-xs text-rose-600 hover:bg-rose-50" onClick={() => { if (window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ trạng thái pool email Outlook không? Tất cả các hộp thư sẽ được đánh dấu để sử dụng lại.")) void resetOutlookPool("all"); }} disabled={config.enabled}>
                              Đặt lại tất cả trạng thái
                            </Button>
                          </div>
                          <p className="text-xs text-stone-500">Mỗi hộp thư chỉ được đăng ký thành công một lần (trạng thái được ghi trong data/outlook_token_used.json). Hộp thư bị lỗi sẽ được đánh dấu lý do và bạn có thể nhả nút ở trên và thử lại.</p>
                        </div>
                      );
                    })() : null}

                    {type === "cloudmail_gen" || type === "tempmail_lol" || type === "cloudflare_temp_email" || type === "moemail" || type === "inbucket" || type === "yyds_mail" || type === "ddg_mail" ? (
                      <div className="space-y-2">
                        <label className="text-sm text-stone-700">{type === "cloudmail_gen" ? "Tên miền thư điện tử" : type === "inbucket" ? "Danh sách tên miền cơ bản" : "Domain"}</label>
                        <Textarea value={domains} onChange={(event) => updateProvider(index, { domain: event.target.value.split(/[\n,]/).map((item) => item.trim()) })} placeholder={type === "cloudmail_gen" ? "Một tên miền trên mỗi dòng. Nếu để trống, tên miền mặc định của dịch vụ sẽ được sử dụng." : type === "inbucket" ? "Mỗi dòng chứa một tên miền cơ bản và hệ thống sẽ tự động tạo một tên miền phụ ngẫu nhiên." : type === "moemail" ? "Một tên miền trên mỗi dòng" : "Một tên miền trên mỗi dòng. Nếu để trống, tên miền mặc định của dịch vụ sẽ được sử dụng."} className="min-h-20 rounded-xl border-stone-200 bg-white font-mono text-xs" disabled={config.enabled} />
                      </div>
                    ) : null}
                    {type === "cloudmail_gen" ? (
                      <div className="space-y-2">
                        <label className="text-sm text-stone-700">Tên miền phụ (hỗ trợ nhiều)</label>
                        <Textarea value={subdomains} onChange={(event) => updateProvider(index, { subdomain: event.target.value.split(/[\n,]/).map((item) => item.trim()) })} placeholder="Mỗi dòng chứa tiền tố tên miền phụ. Nếu để trống thì tên miền chính sẽ được sử dụng trực tiếp." className="min-h-20 rounded-xl border-stone-200 bg-white font-mono text-xs" disabled={config.enabled} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

      </section>

      <section className="flex min-h-0 flex-col p-4">
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Kết quả chạy</h2>
                <p className="mt-1 text-sm text-stone-500">SSE đẩy trạng thái hiện tại theo thời gian thực.</p>
              </div>
              <Badge variant={config.enabled ? "success" : "secondary"} className="rounded-md">
                {config.enabled ? "Đang chạy" : "Đã dừng"}
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                ["tỷ lệ thành công/thành công", `${stats.success} / ${stats.success_rate || 0}%`],
                ["thất bại", stats.fail],
                ["Hoàn thành", stats.done],
                ["chạy/chuỗi", `${stats.running} / ${stats.threads}`],
                ["thời gian chạy", `${stats.elapsed_seconds || 0}s`],
                ["đăng ký trung bình mỗi", `${stats.avg_seconds || 0}s`],
                ["Hạn ngạch hiện tại", stats.current_quota || 0],
                ["Tài khoản bình thường", stats.current_available || 0],
              ].map(([label, value]) => (
                <div key={label} className="border border-stone-200 bg-white/70 px-3 py-2">
                  <div className="text-xs text-stone-400">{label}</div>
                  <div className="mt-1 text-base font-semibold text-stone-800">{value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button className="h-10 rounded-xl bg-stone-950 px-3 text-white hover:bg-stone-800" onClick={() => void toggle()} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : config.enabled ? <Square className="size-4" /> : <Play className="size-4" />}
                {config.enabled ? "dừng lại" : "bắt đầu"}
              </Button>
              <Button variant="outline" className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700" onClick={() => void reset()} disabled={isSaving || config.enabled}>
                <RotateCcw className="size-4" />
                đặt lại
              </Button>
              <Button variant="outline" className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700" onClick={() => void save()} disabled={isSaving || config.enabled}>
                <Save className="size-4" />
                lưu lại
              </Button>
            </div>
            <div className="flex items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="size-4 shrink-0" />
              Hãy nhớ lưu cấu hình trước khi bắt đầu。
            </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">nhật ký thời gian thực</h3>
                <p className="mt-1 text-xs text-amber-700">Nếu bạn gặp lỗi như mã trạng thái HTTP 400 thì cơ bản là do email của bạn đã bị chặn do lạm dụng và bạn cần đổi sang email tên miền mới.</p>
              </div>
              <Badge variant="secondary" className="rounded-md">
                {logs.length}
              </Badge>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border border-stone-200 bg-white/70 p-3 font-mono text-xs leading-6">
              {logs.length === 0 ? (
                <div className="text-stone-500">Chưa có nhật ký nào</div>
              ) : (
                logs.slice().reverse().map((item, index) => (
                  <div key={`${item.time}-${index}`} className={item.level === "red" ? "text-rose-600" : item.level === "green" ? "text-emerald-700" : item.level === "yellow" ? "text-amber-700" : "text-stone-700"}>
                    <span className="text-stone-400">{new Date(item.time).toLocaleTimeString()}</span>
                    <span className="pl-2">{item.text}</span>
                  </div>
                ))
              )}
            </div>
        </div>
      </section>
    </div>
  );
}
