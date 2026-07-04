"use client";

import { EditableFilePanel } from "./editable-file-panel";

const defaultPrompt = 'Need to create a PPT "Q2 2026 E-commerce Operations Work Report" for the company\'s quarterly leadership meeting. Keep total page count within 8 pages with a professional business technology style. Highlight sales growth, user acquisition, promotional campaigns, and double 11 event results, presenting them via line charts, bar charts, donut charts, and funnel charts.';

export function PptPanel() {
  return <EditableFilePanel title="Generate PPT" kind="ppt" endpoint="/v1/ppt/generations" defaultPrompt={defaultPrompt} />;
}
