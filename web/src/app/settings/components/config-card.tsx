"use client";

import { Cloud, LoaderCircle, PlugZap, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ImageStorageMode } from "@/lib/api";
import { testProxy, type ProxyTestResult } from "@/lib/api";

import { useSettingsStore } from "../store";

export function ConfigCard() {
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<ProxyTestResult | null>(null);
  const logLevelOptions = ["debug", "info", "warning", "error"];
  const config = useSettingsStore((state) => state.config);
  const isLoadingConfig = useSettingsStore((state) => state.isLoadingConfig);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const setRefreshAccountIntervalMinute = useSettingsStore((state) => state.setRefreshAccountIntervalMinute);
  const setImageRetentionDays = useSettingsStore((state) => state.setImageRetentionDays);
  const setImagePollTimeoutSecs = useSettingsStore((state) => state.setImagePollTimeoutSecs);
  const setImageAccountConcurrency = useSettingsStore((state) => state.setImageAccountConcurrency);
  const setImageSettleEnabled = useSettingsStore((state) => state.setImageSettleEnabled);
  const setImageRemoveConversationAfterResult = useSettingsStore((state) => state.setImageRemoveConversationAfterResult);
  const setImageSettleSecs = useSettingsStore((state) => state.setImageSettleSecs);
  const setImageTimeoutRetrySecs = useSettingsStore((state) => state.setImageTimeoutRetrySecs);
  const setAutoRemoveInvalidAccounts = useSettingsStore((state) => state.setAutoRemoveInvalidAccounts);
  const setAutoRemoveRateLimitedAccounts = useSettingsStore((state) => state.setAutoRemoveRateLimitedAccounts);
  const setAutoReloginAfterRefresh = useSettingsStore((state) => state.setAutoReloginAfterRefresh);
  const setLogLevel = useSettingsStore((state) => state.setLogLevel);
  const setProxy = useSettingsStore((state) => state.setProxy);
  const setBaseUrl = useSettingsStore((state) => state.setBaseUrl);
  const setGlobalSystemPrompt = useSettingsStore((state) => state.setGlobalSystemPrompt);
  const setSensitiveWordsText = useSettingsStore((state) => state.setSensitiveWordsText);
  const setAIReviewField = useSettingsStore((state) => state.setAIReviewField);
  const setImageStorageField = useSettingsStore((state) => state.setImageStorageField);
  const testImageStorage = useSettingsStore((state) => state.testImageStorage);
  const syncImagesToWebDAV = useSettingsStore((state) => state.syncImagesToWebDAV);
  const isTestingImageStorage = useSettingsStore((state) => state.isTestingImageStorage);
  const isSyncingImageStorage = useSettingsStore((state) => state.isSyncingImageStorage);
  const saveConfig = useSettingsStore((state) => state.saveConfig);

  const handleTestProxy = async () => {
    const candidate = String(config?.proxy || "").trim();
    if (!candidate) {
      toast.error("Vui lòng điền địa chỉ proxy trước");
      return;
    }
    setIsTestingProxy(true);
    setProxyTestResult(null);
    try {
      const data = await testProxy(candidate);
      setProxyTestResult(data.result);
      if (data.result.ok) {
        toast.success(`Có sẵn proxy (${data.result.latency_ms} ms, HTTP ${data.result.status})`);
      } else {
        toast.error(`proxy không có sẵn：${data.result.error ?? "lỗi không xác định"}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Proxy thử nghiệm không thành công");
    } finally {
      setIsTestingProxy(false);
    }
  };

  if (isLoadingConfig) {
    return (
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardContent className="flex items-center justify-center p-10">
          <LoaderCircle className="size-5 animate-spin text-stone-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
          Khóa đăng nhập quản trị viên tiếp tục được đọc từ cấu hình triển khai，Không hiển thị trên trang này nữa；Để phân phát cho người khác，Vui lòng tạo khóa người dùng bình thường bên dưới。
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-stone-700">Khoảng thời gian làm mới tài khoản</label>
            <Input
              value={String(config?.refresh_account_interval_minute || "")}
              onChange={(event) => setRefreshAccountIntervalMinute(event.target.value)}
              placeholder="phút"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <p className="text-xs text-stone-500">Trong vài phút, kiểm soát tần suất làm mới tự động của tài khoản.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-stone-700">proxy toàn cầu</label>
            <Input
              value={String(config?.proxy || "")}
              onChange={(event) => {
                setProxy(event.target.value);
                setProxyTestResult(null);
              }}
              placeholder="http://127.0.0.1:7890"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <p className="text-xs leading-5 text-stone-500">
              Để trống để không sử dụng proxy。Thỏa thuận hỗ trợ://tài khoản:Mật khẩu@Máy chủ:hải cảng，Bạn cũng có thể dán trực tiếp proxy Máy chủ:hải cảng:tài khoản:Mật khẩu；Ví dụ http://user:pass@127.0.0.1:7890、127.0.0.1:7890:user:pass。Mật khẩu tài khoản bao gồm @/: Bắt buộc khi chờ ký tự đặc biệt URL mã hóa。
            </p>
            {proxyTestResult ? (
              <div
                className={`rounded-xl border px-3 py-2 text-xs leading-6 ${
                  proxyTestResult.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {proxyTestResult.ok
                  ? `Proxy khả dụng: HTTP ${proxyTestResult.status}, thời gian ${proxyTestResult.latency_ms} ms`
                  : `proxy không có sẵn：${proxyTestResult.error ?? "lỗi không xác định"}（thời gian ${proxyTestResult.latency_ms} ms）`}
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl border-stone-200 bg-white px-4 text-stone-700"
                onClick={() => void handleTestProxy()}
                disabled={isTestingProxy}
              >
                {isTestingProxy ? <LoaderCircle className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                chất thử nghiệm
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-stone-700">Địa chỉ truy cập hình ảnh</label>
            <Input
              value={String(config?.base_url || "")}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://example.com"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <p className="text-xs text-stone-500">Địa chỉ tiền tố truy cập được sử dụng để tạo kết quả hình ảnh.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-stone-700">Tự động làm sạch hình ảnh</label>
            <Input
              value={String(config?.image_retention_days || "")}
              onChange={(event) => setImageRetentionDays(event.target.value)}
              placeholder="30"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <p className="text-xs text-stone-500">Tự động xóa hình ảnh cục bộ từ bao nhiêu ngày trước.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-stone-700">Hết thời gian bỏ phiếu hình ảnh</label>
            <Input
              value={String(config?.image_poll_timeout_secs || "")}
              onChange={(event) => setImagePollTimeoutSecs(event.target.value)}
              placeholder="120"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <p className="text-xs text-stone-500">Tính bằng giây, thời gian tối đa để chờ kết quả hình ảnh upstream.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-stone-700">Đồng thời hình ảnh một tài khoản</label>
            <Input
              value={String(config?.image_account_concurrency || "")}
              onChange={(event) => setImageAccountConcurrency(event.target.value)}
              placeholder="1"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <p className="text-xs text-stone-500">Giới hạn số lượng yêu cầu hình ảnh được mỗi tài khoản xử lý cùng lúc, mặc định là 3.</p>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <Checkbox
                checked={Boolean(config?.auto_remove_invalid_accounts)}
                onCheckedChange={(checked) => setAutoRemoveInvalidAccounts(Boolean(checked))}
              />
              Tự động loại bỏ các tài khoản bất thường
            </label>
            <p className="text-xs text-stone-500">Phát hiện và loại bỏ khi làm mới</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <Checkbox
                checked={Boolean(config?.image_settle_enabled !== false)}
                onCheckedChange={(checked) => setImageSettleEnabled(Boolean(checked))}
              />
              <span className="text-sm text-stone-700">Cơ chế xác nhận thứ cấp hình ảnh</span>
            </div>
            <p className="text-xs text-stone-500">Sau khi mở nó, tỷ lệ lấy được hình ảnh thành công có thể được cải thiện đôi chút.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <Checkbox
                checked={Boolean(config?.image_remove_conversation_after_result)}
                onCheckedChange={(checked) => setImageRemoveConversationAfterResult(Boolean(checked))}
              />
              <span className="text-sm text-stone-700">Loại bỏ hội thoại cục bộ sau khi xuất hình ảnh</span>
            </div>
            <p className="text-xs text-stone-500">Sau khi lấy được hình ảnh thành công, tự động ẩn cuộc hội thoại tương ứng trên ChatGPT ở chế độ bất đồng bộ.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-stone-700">Thời gian chờ hình ảnh tiếp tục thời gian chờ đợi</label>
            <Input
              value={String(config?.image_timeout_retry_secs || "30")}
              onChange={(event) => setImageTimeoutRetrySecs(event.target.value)}
              placeholder="30"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <p className="text-xs text-stone-500">Đơn vị là giây, thời gian chờ bổ sung sau khi nhấp vào &quot;Tiếp tục chờ&quot; sau khi hết thời gian chờ.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-stone-700">Hình ảnh thời gian chờ xác nhận thứ cấp</label>
            <Input
              value={String(config?.image_settle_secs || "2.0")}
              onChange={(event) => setImageSettleSecs(event.target.value)}
              placeholder="2.0"
              className="h-10 rounded-xl border-stone-200 bg-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!config?.image_settle_enabled}
            />
            <p className="text-xs text-stone-500">Tính bằng giây, phải đợi bao lâu để xác nhận lại sau khi tìm thấy ảnh. Nó cần được sử dụng cùng với cơ chế xác nhận thứ cấp hình ảnh.</p>
          </div>
          <div className="flex gap-4 md:col-span-2">
            <div className="flex-1 space-y-2">
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                <Checkbox
                  checked={Boolean(config?.auto_relogin_after_refresh)}
                  onCheckedChange={(checked) => setAutoReloginAfterRefresh(Boolean(checked))}
                />
                Tự động cố gắng loại bỏ trạng thái bất thường sau khi làm mới
              </label>
              <p className="text-xs text-stone-500">Tự động thử mật khẩu để đăng nhập và khôi phục tài khoản khi làm mới sau khi bật.</p>
            </div>
            <div className="flex-1" aria-hidden="true" />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <Checkbox
              checked={Boolean(config?.auto_remove_rate_limited_accounts)}
              onCheckedChange={(checked) => setAutoRemoveRateLimitedAccounts(Boolean(checked))}
            />
            Tự động xóa tài khoản bị giới hạn hiện tại
          </label>
          <div className="space-y-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div>
              <label className="text-sm text-stone-700">Cấp độ nhật ký bảng điều khiển</label>
              <p className="mt-1 text-xs text-stone-500">Sử dụng thông tin/cảnh báo/lỗi mặc định khi không được chọn.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {logLevelOptions.map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm capitalize text-stone-700">
                  <Checkbox
                    checked={Boolean(config?.log_levels?.includes(level))}
                    onCheckedChange={(checked) => setLogLevel(level, Boolean(checked))}
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-stone-700">Chỉ thị bổ sung toàn cầu</label>
            <Textarea
              value={String(config?.global_system_prompt || "")}
              onChange={(event) => setGlobalSystemPrompt(event.target.value)}
              placeholder="Ví dụ: trước tiên hãy xác định xem lời nhắc của người dùng có tuân thủ hay không; từ chối trả lời khi gặp các yêu cầu trái pháp luật, khiêu dâm, bạo lực, hận thù, v.v."
              className="min-h-28 rounded-xl border-stone-200 bg-white font-mono text-xs shadow-none"
            />
            <p className="text-xs text-stone-500">Mỗi yêu cầu được đưa vào dưới dạng một thông báo hệ thống, có thể được sử dụng để xem xét lời nhắc của người dùng, tránh nội dung bất hợp pháp, hạn chế thống nhất hành vi của mô hình hoặc sửa các cài đặt vai trò.</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-stone-700">từ ngữ nhạy cảm</label>
            <Textarea
              value={(config?.sensitive_words || []).join("\n")}
              onChange={(event) => setSensitiveWordsText(event.target.value)}
              placeholder="Một dòng trên mỗi dòng, nhấn và từ chối"
              className="min-h-28 rounded-xl border-stone-200 bg-white font-mono text-xs shadow-none"
            />
            <p className="text-xs text-stone-500">Miễn là yêu cầu của người dùng có chứa bất kỳ từ nhạy cảm nào thì lời từ chối sẽ được trả lại trực tiếp.</p>
          </div>
          <div className="space-y-4 rounded-xl border border-stone-200 bg-white px-4 py-3 md:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3 text-sm text-stone-700">
                <Checkbox
                  checked={Boolean(config?.image_storage?.enabled)}
                  onCheckedChange={(checked) => setImageStorageField("enabled", Boolean(checked))}
                />
                kích hoạt WebDAV Lưu trữ hình ảnh
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-stone-200 bg-white px-4 text-stone-700"
                  onClick={() => void testImageStorage()}
                  disabled={isTestingImageStorage || !config?.image_storage?.enabled}
                >
                  {isTestingImageStorage ? <LoaderCircle className="size-4 animate-spin" /> : <Cloud className="size-4" />}
                  kiểm tra WebDAV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-stone-200 bg-white px-4 text-stone-700"
                  onClick={() => void syncImagesToWebDAV()}
                  disabled={isSyncingImageStorage || !config?.image_storage?.enabled || config?.image_storage?.mode === "local"}
                >
                  {isSyncingImageStorage ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Đồng bộ hóa hoàn toàn
                </Button>
              </div>
            </div>
            <p className="text-xs leading-6 text-stone-500">
              Chỉ xử lý hình ảnh mới này khi tạo；Đồng bộ hóa hoàn toàn được sử dụng để bổ sung các hình ảnh cục bộ hiện có vào WebDAV。
            </p>
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-600">
              Chế độ hiện tại sẽ được lưu：
              <span className="ml-1 font-medium text-stone-900">
                {config?.image_storage?.enabled
                  ? config.image_storage.mode === "both"
                    ? "Bản địa + WebDAV"
                    : config.image_storage.mode === "webdav"
                      ? "Chỉ WebDAV"
                      : "Máy này chỉ"
                  : "Máy này chỉ"}
              </span>
              <span className="ml-2 text-stone-400">Sau khi sửa đổi, bạn cần nhấp vào Lưu hoặc lưu tự động thông qua nút Kiểm tra/Đồng bộ hóa.</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm text-stone-700">chế độ lưu</label>
                <Select
                  value={String(config?.image_storage?.mode || "local")}
                  onValueChange={(value) => setImageStorageField("mode", value as ImageStorageMode)}
                  disabled={!config?.image_storage?.enabled}
                >
                  <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Máy này chỉ</SelectItem>
                    <SelectItem value="webdav">Chỉ WebDAV</SelectItem>
                    <SelectItem value="both">Bản địa + WebDAV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-stone-700">WebDAV URL</label>
                <Input
                  value={String(config?.image_storage?.webdav_url || "")}
                  onChange={(event) => setImageStorageField("webdav_url", event.target.value)}
                  placeholder="https://example.com/dav"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                  disabled={!config?.image_storage?.enabled}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Tên người dùng</label>
                <Input
                  value={String(config?.image_storage?.webdav_username || "")}
                  onChange={(event) => setImageStorageField("webdav_username", event.target.value)}
                  className="h-10 rounded-xl border-stone-200 bg-white"
                  disabled={!config?.image_storage?.enabled}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Mật khẩu</label>
                <Input
                  type="password"
                  value={String(config?.image_storage?.webdav_password || "")}
                  onChange={(event) => setImageStorageField("webdav_password", event.target.value)}
                  className="h-10 rounded-xl border-stone-200 bg-white"
                  disabled={!config?.image_storage?.enabled}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">thư mục từ xa</label>
                <Input
                  value={String(config?.image_storage?.webdav_root_path || "")}
                  onChange={(event) => setImageStorageField("webdav_root_path", event.target.value)}
                  placeholder="chatgpt2api/images"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                  disabled={!config?.image_storage?.enabled}
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <label className="text-sm text-stone-700">tiền tố truy cập công cộng</label>
                <Input
                  value={String(config?.image_storage?.public_base_url || "")}
                  onChange={(event) => setImageStorageField("public_base_url", event.target.value)}
                  placeholder="https://cdn.example.com/chatgpt2api/images"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                  disabled={!config?.image_storage?.enabled}
                />
                <p className="text-xs text-stone-500">Nếu để trống, nó sẽ trở về địa chỉ proxy /images/... của ứng dụng này; sau khi điền vào, nó sẽ trực tiếp trở về địa chỉ hình ảnh công khai.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-xl border border-stone-200 bg-white px-4 py-3 md:col-span-2">
            <label className="flex items-center gap-3 text-sm text-stone-700">
              <Checkbox
                checked={Boolean(config?.ai_review?.enabled)}
                onCheckedChange={(checked) => setAIReviewField("enabled", Boolean(checked))}
              />
              kích hoạt AI đánh giá
            </label>
            <p className="text-xs leading-6 text-stone-500">
              Khi được bật, mô hình kiểm tra sẽ được gọi trước khi yêu cầu nhập tài khoản Shengtu.，Việc không vượt qua được đánh giá sẽ dẫn đến việc bị từ chối trực tiếp.，Giảm nguy cơ lời nhắc bất hợp pháp đến tài khoản, gây ra rủi ro kiểm soát hoặc đình chỉ tài khoản。
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Base URL</label>
                <Input value={String(config?.ai_review?.base_url || "")} onChange={(event) => setAIReviewField("base_url", event.target.value)} placeholder="https://api.openai.com" className="h-10 rounded-xl border-stone-200 bg-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">API Key</label>
                <Input value={String(config?.ai_review?.api_key || "")} onChange={(event) => setAIReviewField("api_key", event.target.value)} placeholder="sk-..." className="h-10 rounded-xl border-stone-200 bg-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Model</label>
                <Input value={String(config?.ai_review?.model || "")} onChange={(event) => setAIReviewField("model", event.target.value)} placeholder="gpt-5.4-mini" className="h-10 rounded-xl border-stone-200 bg-white" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-stone-700">Kiểm tra lời nhắc</label>
              <Textarea value={String(config?.ai_review?.prompt || "")} onChange={(event) => setAIReviewField("prompt", event.target.value)} placeholder="Xác định xem yêu cầu của người dùng có được phép hay không. Chỉ cần trả lời CHO PHÉP hoặc TỪ CHỐI." className="min-h-24 rounded-xl border-stone-200 bg-white text-xs shadow-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
            onClick={() => void saveConfig()}
            disabled={isSavingConfig}
          >
            {isSavingConfig ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            lưu lại
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
