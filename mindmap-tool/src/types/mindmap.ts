// マインドマップの内部データ型定義

export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];
  collapsed: boolean;
}

export interface MapTheme {
  edgeColor: string;
  buttonColor: string;
}

export interface MindMapFile {
  version: string;
  createdAt: string;
  updatedAt: string;
  root: MindMapNode;
  theme?: MapTheme;
}

// React Flow 用のノードデータ
export interface NodeData {
  node: MindMapNode;
  isRoot: boolean;
  isEditing: boolean;
  isDragTarget: boolean;
  isSelected: boolean;
  nodeWidth: number;
  buttonColor: string;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, text: string) => void;
  onCancelEdit: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onToggleCollapse: (id: string) => void;
  onDraftChange: (id: string, text: string) => void;
}

// 右クリックメニューの状態
export interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}
