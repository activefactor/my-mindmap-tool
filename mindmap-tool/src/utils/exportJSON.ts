import type { MindMapNode, MindMapFile, MapTheme } from '../types/mindmap';

export const exportJSON = (root: MindMapNode, theme: MapTheme): void => {
  const file: MindMapFile = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    root,
    theme,
  };

  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindmap_${formatDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const formatDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const pad = (n: number): string => String(n).padStart(2, '0');
