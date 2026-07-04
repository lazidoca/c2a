"use client";

import { EditableFilePanel } from "./editable-file-panel";

const defaultPrompt = "Tách các thành phần áp phích theo vị trí hình ảnh gốc và tổng hợp chúng thành PSD có thể chỉnh sửa, giữ lại nền và vị trí lớp của từng thành phần, đồng thời xuất ra từng zip vật liệu lớp.";

export function PsdPanel() {
  return <EditableFilePanel title="thế hệ PSD" kind="psd" endpoint="/v1/psd/generations" defaultPrompt={defaultPrompt} imageRequired />;
}
