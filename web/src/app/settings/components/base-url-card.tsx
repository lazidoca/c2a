"use client";

import { Globe, LoaderCircle, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useSettingsStore } from "../store";

export function BaseUrlCard() {
  const config = useSettingsStore((state) => state.config);
  const isLoadingConfig = useSettingsStore((state) => state.isLoadingConfig);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const setBaseUrl = useSettingsStore((state) => state.setBaseUrl);
  const saveConfig = useSettingsStore((state) => state.saveConfig);

  const baseUrl = String(config?.base_url || "");

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
              <Globe className="size-5 text-stone-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">địa chỉ cơ sở</h2>
              <p className="text-sm text-stone-500">Đặt giá trị cấu hình cục bộ của `CHATGPT2API_BASE_URL`, giá trị này sẽ có hiệu lực ngay sau khi lưu.</p>
            </div>
          </div>
          <Badge variant={baseUrl.trim() ? "success" : "secondary"} className="w-fit rounded-md px-2.5 py-1">
            {baseUrl.trim() ? "được cấu hình" : "Chưa được định cấu hình"}
          </Badge>
        </div>

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-10">
            <LoaderCircle className="size-5 animate-spin text-stone-400" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">Base URL</label>
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://example.com"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
              <p className="text-sm text-stone-500">Nếu để trống, các biến môi trường hoặc giá trị mặc định sẽ được sử dụng và các khoảng trắng ở đầu và cuối sẽ tự động bị xóa khi lưu.</p>
            </div>

            <div className="flex justify-end">
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void saveConfig()}
                disabled={isSavingConfig}
              >
                {isSavingConfig ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Lưu cấu hình
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
