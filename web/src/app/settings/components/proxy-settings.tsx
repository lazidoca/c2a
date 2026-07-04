"use client";

import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle,
  PlugZap,
  Save,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchProxy,
  testProxy,
  updateProxy,
  type ProxySettings,
  type ProxyTestResult,
} from "@/lib/api";

export function ProxySettingsCard() {
  const didLoadRef = useRef(false);
  const [settings, setSettings] = useState<ProxySettings>({ enabled: false, url: "" });
  const [formUrl, setFormUrl] = useState("");
  const [formEnabled, setFormEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await fetchProxy();
      setSettings(data.proxy);
      setFormUrl(data.proxy.url);
      setFormEnabled(data.proxy.enabled);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được cấu hình proxy");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (didLoadRef.current) {
      return;
    }
    didLoadRef.current = true;
    void load();
  }, []);

  const urlChanged = formUrl.trim() !== settings.url;
  const enabledChanged = formEnabled !== settings.enabled;
  const dirty = urlChanged || enabledChanged;

  const handleSave = async () => {
    if (formEnabled && !formUrl.trim()) {
      toast.error("Địa chỉ proxy phải được điền khi kích hoạt proxy");
      return;
    }
    setIsSaving(true);
    try {
      const payload: { enabled?: boolean; url?: string } = {};
      if (enabledChanged) payload.enabled = formEnabled;
      if (urlChanged) payload.url = formUrl.trim();
      const data = await updateProxy(payload);
      setSettings(data.proxy);
      setFormUrl(data.proxy.url);
      setFormEnabled(data.proxy.enabled);
      toast.success("Đã lưu cấu hình proxy");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lưu không thành công");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    const candidate = formUrl.trim();
    if (!candidate) {
      toast.error("Vui lòng điền địa chỉ proxy trước");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const data = await testProxy(candidate);
      setTestResult(data.result);
      if (data.result.ok) {
        toast.success(`Có sẵn proxy (${data.result.latency_ms} ms, HTTP ${data.result.status})`);
      } else {
        toast.error(`proxy không có sẵn：${data.result.error ?? "lỗi không xác định"}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Proxy thử nghiệm không thành công");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
              <Wifi className="size-5 text-stone-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Cấu hình proxy upstream</h2>
              <p className="text-sm text-stone-500">
                cho chatgpt.com Yêu cầu định cấu hình proxy gửi đi，Thích hợp triển khai server trong nước；Sub2API / CPA Yêu cầu không bị ảnh hưởng。
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <LoaderCircle className="size-5 animate-spin text-stone-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                checked={formEnabled}
                onChange={(event) => setFormEnabled(event.target.checked)}
              />
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-stone-800">Bật proxy</div>
                <div className="text-sm text-stone-500">
                  Sau khi đóng cửa chatgpt.com Các yêu cầu sẽ được chuyển tới。Có hiệu lực ngay sau khi lưu，Không cần phải khởi động lại。
                </div>
              </div>
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                <PlugZap className="size-3.5" />
                địa chỉ proxy
              </label>
              <Input
                value={formUrl}
                onChange={(event) => setFormUrl(event.target.value)}
                placeholder="http://user:pass@host:port hoặc socks5://host:port"
                className="h-11 rounded-xl border-stone-200 bg-white font-mono text-xs"
              />
              <div className="text-xs text-stone-400">
                hỗ trợ <code className="font-mono">http / https / socks4 / socks5 / socks5h</code>。
              </div>
            </div>

            {testResult ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
                  testResult.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {testResult.ok ? (
                  <>
                    proxy có sẵn：HTTP {testResult.status}，thời gian {testResult.latency_ms} ms
                  </>
                ) : (
                  <>proxy không có sẵn：{testResult.error ?? "lỗi không xác định"}（thời gian {testResult.latency_ms} ms）</>
                )}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void handleSave()}
                disabled={isSaving || !dirty}
              >
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                lưu lại
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl border-stone-200 bg-white px-5 text-stone-700"
                onClick={() => void handleTest()}
                disabled={isTesting}
              >
                {isTesting ? <LoaderCircle className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                Kiểm tra kết nối
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
