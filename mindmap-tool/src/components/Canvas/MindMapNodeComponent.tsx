import { memo, useRef, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData } from '../../types/mindmap';

const MAX_TEXT_LENGTH = 500;

export const MindMapNodeComponent = memo(({ data }: NodeProps<NodeData>) => {
  const {
    node,
    isRoot,
    isEditing,
    isDragTarget,
    isSelected,
    nodeWidth,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onContextMenu,
    onToggleCollapse,
    onDraftChange,
  } = data;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const draftRef = useRef(node.text); // compositionEnd 内で最新 draft を参照するため
  const [draft, setDraft] = useState(node.text);
  draftRef.current = draft; // レンダーのたびに同期

  // 編集開始時のみ初期化・フォーカス・高さリセット
  useEffect(() => {
    if (isEditing) {
      setDraft(node.text);
      setTimeout(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.select();
        // 初期高さを内容に合わせる
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // nodeWidth が変わった（レイアウト再計算後）タイミングでtextarea高さを再計算する。
  // 入力時に古い幅で折り返し高さが設定された後、幅が広がった時に高さを正しく縮める。
  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [nodeWidth, isEditing]);

  const hasChildren = node.children.length > 1;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // IME変換中の確定Enterは無視
      if (e.nativeEvent.isComposing) return;
      // Shift+Enter は改行を挿入（preventDefault しない）
      if (e.shiftKey) return;
      e.preventDefault();
      onCommitEdit(node.id, draft);
    }
    if (e.key === 'Escape') { onCancelEdit(); }
    e.stopPropagation();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);
    draftRef.current = value;
    // 変換中でも幅追従のためレイアウト更新する。
    // ノード自身のX・Yは自分の幅では変わらないため IME ウィンドウ位置は安定する。
    onDraftChange(node.id, value);
    if (!isComposingRef.current) {
      // 高さ調整は変換中スキップ（ローマ字入力で縦に伸びるのを防ぐ）
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    }
  };

  // ---- スタイル計算 ----
  // 非選択・非編集・非ルートのノードは背景/ボーダーを透明にして文字だけを表示する。
  // 選択時・編集時・ルートは従来のボックススタイルを維持。
  const isBoxVisible = isRoot || isEditing || isSelected || isDragTarget;

  const ringStyle = isSelected
    ? `0 0 0 2px var(--color-primary-500), var(--shadow-lg)`
    : isDragTarget
      ? 'var(--shadow-lg)'
      : isRoot
        ? 'var(--shadow-md)'
        : 'none';

  const borderColor = isDragTarget
    ? 'var(--color-primary-500)'
    : isSelected
      ? 'var(--color-primary-400)'
      : isBoxVisible
        ? 'var(--color-border-node)'
        : 'transparent';

  const borderWidth = isDragTarget || isSelected
    ? 'var(--border-width-thick)'
    : 'var(--border-width-default)';

  const bgColor = isRoot
    ? 'var(--color-bg-node-root)'
    : isEditing
      ? 'var(--color-bg-node)'
      : isDragTarget
        ? 'var(--color-bg-node-hover)'
        : isSelected
          ? 'var(--color-bg-node-selected)'
          : 'transparent';

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, node.id)}
      onDoubleClick={() => onStartEdit(node.id)}
      style={{
        width: `${nodeWidth}px`,
        background: bgColor,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: isRoot ? 'var(--radius-lg)' : 'var(--radius-md)',
        boxShadow: ringStyle,
        padding: isRoot
          ? 'var(--spacing-3) var(--spacing-6)'
          : 'var(--spacing-2) var(--spacing-4)',
        cursor: 'default',
        position: 'relative',
        transition: [
          'box-shadow var(--transition-fast)',
          'border-color var(--transition-fast)',
          'background var(--transition-fast)',
          'transform var(--transition-fast)',
        ].join(', '),
        userSelect: 'none',
        transform: isDragTarget ? 'scale(1.04)' : 'scale(1)',
        boxSizing: 'border-box',
      }}
    >
      {!isRoot && (
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      )}

      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            // 変換確定後に高さ・レイアウトを更新
            const el = textareaRef.current;
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }
            onDraftChange(node.id, draftRef.current);
          }}
          onBlur={() => {
            if (isComposingRef.current) return;
            onCommitEdit(node.id, draftRef.current);
          }}
          maxLength={MAX_TEXT_LENGTH}
          rows={1}
          style={{
            font: 'inherit',
            fontSize: isRoot ? 'var(--font-size-xl)' : 'var(--font-size-base)',
            fontWeight: isRoot ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
            color: isRoot ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            lineHeight: 'var(--line-height-base)',
            resize: 'none',
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            display: 'block',
            wordBreak: 'break-all',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: isRoot ? 'var(--font-size-xl)' : 'var(--font-size-base)',
            fontWeight: isRoot ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
            color: isRoot ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
            lineHeight: 'var(--line-height-base)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            display: 'block',
          }}
        >
          {node.text}
        </span>
      )}

      {hasChildren && (
        // ステム線＋丸ボタンをノードの右端から外側へ配置
        // left: 100% でノード右端を起点に外へ伸びる
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
          title={node.collapsed ? '展開' : '折りたたむ'}
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {/* ノード右端から伸びるステム線（エッジと同色・同太さ） */}
          <div style={{
            width: '3px',
            height: '3px',
            background: 'var(--color-gray-400)',
            flexShrink: 0,
          }} />
          {/* 交点に置く丸：展開中=塗りつぶし、折りたたみ時=白抜き */}
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            flexShrink: 0,
            background: node.collapsed ? 'var(--color-gray-0)' : 'var(--color-gray-400)',
            border: '1.5px solid var(--color-gray-400)',
            boxSizing: 'border-box',
          }} />
        </button>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
});

MindMapNodeComponent.displayName = 'MindMapNodeComponent';
