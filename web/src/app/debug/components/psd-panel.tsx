"use client";

import { EditableFilePanel } from "./editable-file-panel";

const defaultPrompt = "Separate the poster elements based on their original positions in the image and compile them into an editable PSD file. Retain the background and layer positions for each element, and export each layer's assets into a zip folder.";

export function PsdPanel() {
  return <EditableFilePanel title="Generate PSD" kind="psd" endpoint="/v1/psd/generations" defaultPrompt={defaultPrompt} imageRequired />;
}
