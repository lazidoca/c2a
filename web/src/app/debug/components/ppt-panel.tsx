"use client";

import { EditableFilePanel } from "./editable-file-panel";

const defaultPrompt = 'Cần phải lập PPT "Báo cáo công việc hoạt động thương mại điện tử quý 2 năm 2026" cho báo cáo cuộc họp hàng quý của ban lãnh đạo công ty. Tổng số trang phải được kiểm soát trong vòng 8 trang và phong cách mang tính công nghệ kinh doanh hơn. Tập trung vào việc phản ánh mức tăng trưởng doanh số bán hàng, mức tăng trưởng người dùng, hiệu ứng quảng cáo và 618 kết quả hoạt động, đồng thời trình bày chúng thông qua biểu đồ đường, biểu đồ thanh, biểu đồ bánh rán và biểu đồ kênh.';

export function PptPanel() {
  return <EditableFilePanel title="Tạo PPT" kind="ppt" endpoint="/v1/ppt/generations" defaultPrompt={defaultPrompt} />;
}
