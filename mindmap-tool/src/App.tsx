import { useCallback, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';

import { Toolbar } from './components/Toolbar/Toolbar';
import { MindMapCanvas } from './components/Canvas/MindMapCanvas';
import { NodeContextMenu } from './components/ContextMenu/NodeContextMenu';

import { useHistory } from './hooks/useHistory';
import { useMindMap } from './hooks/useMindMap';
import { useKeyboard } from './hooks/useKeyboard';
import { useAutoSave, loadFromStorage } from './hooks/useLocalStorage';

import type { MindMapNode, ContextMenuState } from './types/mindmap';
import { generateId } from './utils/generateId';
import { nodeToText } from './utils/exportText';
import { parseIndentText } from './utils/importText';
import { exportPNG } from './utils/exportPNG';
import { exportPDF } from './utils/exportPDF';

const createInitialRoot = (): MindMapNode => ({
  id: generateId(),
  text: 'メインテーマ',
  children: [],
  collapsed: false,
});

const loadInitial = (): MindMapNode => loadFromStorage() ?? createInitialRoot();

// ReactFlow の fitView は Provider 内でしか使えないため内部コンポーネントに分離
const AppInner = () => {
  const { fitView } = useReactFlow();

  const { current, commit, undo, redo, reset, canUndo, canRedo } = useHistory(loadInitial());
  const { addChild, addSibling, deleteNode, updateText, toggleCollapse, moveNode, pasteNode } = useMindMap(current, commit);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const pendingFocusId = useRef<string | null>(null);

  useAutoSave(current);

  // --- 編集 ---
  const handleStartEdit = useCallback((id: string) => {
    setContextMenu(null);
    setEditingId(id);
  }, []);

  const handleCommitEdit = useCallback((id: string, text: string) => {
    if (text.trim()) updateText(id, text.trim());
    setEditingId(null);
  }, [updateText]);

  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  // --- ノード追加（追加後に新ノードを編集モードに） ---
  // targetId を明示渡しすることで右クリックメニューの非同期state問題を回避
  const handleAddChild = useCallback((targetId?: string) => {
    const id = targetId ?? selectedId ?? current.id;
    const newId = addChild(id);
    if (newId) {
      setSelectedId(newId);
      pendingFocusId.current = newId;
      setEditingId(newId);
    }
  }, [selectedId, current.id, addChild]);

  const handleAddSibling = useCallback((targetId?: string) => {
    const id = targetId ?? selectedId;
    if (!id) return;
    const newId = addSibling(id);
    if (newId) {
      setSelectedId(newId);
      pendingFocusId.current = newId;
      setEditingId(newId);
    }
  }, [selectedId, addSibling]);

  // --- 削除（Undo で復元可能なため確認なし） ---
  const handleDelete = useCallback((targetId?: string) => {
    const id = targetId ?? selectedId;
    if (!id || id === current.id) return;
    deleteNode(id);
    setSelectedId(null);
  }, [selectedId, current, deleteNode]);

  // --- 新規作成 ---
  const handleNew = useCallback(() => {
    if (!window.confirm('現在のマップを破棄して新規作成しますか？')) return;
    reset(createInitialRoot());
    setSelectedId(null);
    setEditingId(null);
  }, [reset]);

  // --- インポート ---
  const handleImport = useCallback((root: MindMapNode) => {
    reset(root);
    setSelectedId(null);
    setEditingId(null);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [reset, fitView]);

  // --- フィット ---
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  // --- エクスポート ---
  // fitView で全ノードを画面に収めてから撮影（DOM を変更しないため SVG エッジが確実に写る）
  const handleExportPNG = useCallback(async () => {
    fitView({ padding: 0.15 });
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await exportPNG();
  }, [fitView]);

  const handleExportPDF = useCallback(async () => {
    fitView({ padding: 0.15 });
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await exportPDF();
  }, [fitView]);

  // --- クリップボードコピー ---
  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    const find = (node: MindMapNode): MindMapNode | null =>
      node.id === selectedId ? node : node.children.map(find).find(Boolean) ?? null;
    const target = find(current);
    if (!target) return;
    navigator.clipboard.writeText(nodeToText(target)).catch(() => {/* コピー失敗は無視 */});
  }, [selectedId, current]);

  // --- カット ---
  const handleCut = useCallback(() => {
    if (!selectedId || selectedId === current.id) return;
    const find = (node: MindMapNode): MindMapNode | null =>
      node.id === selectedId ? node : node.children.map(find).find(Boolean) ?? null;
    const target = find(current);
    if (!target) return;
    navigator.clipboard.writeText(nodeToText(target)).then(() => {
      handleDelete(selectedId);
    }).catch(() => {/* クリップボード書き込み失敗は無視 */});
  }, [selectedId, current, deleteNode]);

  // --- ペースト ---
  const handlePaste = useCallback(async () => {
    const targetId = selectedId ?? current.id;
    try {
      const text = await navigator.clipboard.readText();
      if (text.length > 1 * 1024 * 1024) return; // 1MB超は無視
      const parsed = parseIndentText(text);
      if (!parsed) return;
      pasteNode(targetId, parsed);
    } catch {/* クリップボード読み取り失敗は無視 */}
  }, [selectedId, current.id, pasteNode]);

  // --- キーボード ---
  useKeyboard({
    onUndo: undo,
    onRedo: redo,
    onAddChild: handleAddChild,
    onAddSibling: handleAddSibling,
    onDelete: handleDelete,
    onStartEdit: () => { if (selectedId) handleStartEdit(selectedId); },
    onFitView: handleFitView,
    onSave: () => {},
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    isEditing: editingId !== null,
  });

  const contextMenuTargetIsRoot = contextMenu?.nodeId === current.id;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toolbar
        root={current}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onNew={handleNew}
        onImport={handleImport}
        onFitView={handleFitView}
        onExportPNG={handleExportPNG}
        onExportPDF={handleExportPDF}
      />

      <div style={{ flex: 1, position: 'relative' }}>
        <MindMapCanvas
          root={current}
          selectedId={selectedId}
          editingId={editingId}
          onSelect={setSelectedId}
          onStartEdit={handleStartEdit}
          onCommitEdit={handleCommitEdit}
          onCancelEdit={handleCancelEdit}
          onContextMenu={setContextMenu}
          onToggleCollapse={toggleCollapse}
          onMoveNode={moveNode}
        />

        {contextMenu && (
          <NodeContextMenu
            state={contextMenu}
            isRoot={contextMenuTargetIsRoot}
            onAddChild={() => handleAddChild(contextMenu.nodeId)}
            onAddSibling={() => handleAddSibling(contextMenu.nodeId)}
            onStartEdit={() => handleStartEdit(contextMenu.nodeId)}
            onDelete={() => handleDelete(contextMenu.nodeId)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
