import { memo, useRef, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData } from '../../types/mindmap';

const MAX_TEXT_LENGTH = 500;
// treeToFlow の CHARS_PER_LINE と一致させること。
// この文字数以内 = 1行に収まる = 幅をリアルタイム更新して子ノードを追従させる。
// これを超えたら = 折り返し = 幅固定・高さのみ伸縮。
const SINGLE_LINE_CHARS = 9;

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

  const hasChildren = node.children.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // IME変換中の確定Enterは無視（isComposing=true のとき）
      if (e.nativeEvent.isComposing) return;
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
    if (!isComposingRef.current) {
      // 1行に収まる文字数のときのみレイアウト再計算（子ノードのX座標を追従させる）。
      // 折り返し後は幅を固定し、textareaの高さだけDOMで伸縮させる。
      if (value.length <= SINGLE_LINE_CHARS) {
        onDraftChange(node.id, value);
      }
      // IME変換中は高さ調整もスキップ（ローマ字入力で縦に伸びるのを防ぐ）
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
            // 変換確定後に高さを正しく反映
            const el = textareaRef.current;
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }
            // 1行以内ならレイアウト更新（折り返し後は幅固定のままにする）
            if (draftRef.current.length <= SINGLE_LINE_CHARS) {
              onDraftChange(node.id, draftRef.current);
            }
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
            // テキストを折り返して全文表示（省略なし）
            whiteSpace: 'normal',
            wordBreak: 'break-all',
            display: 'block',
          }}
        >
          {node.text}
        </span>
      )}

      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
          style={{
            position: 'absolute',
            right: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-gray-400)',
            color: 'var(--color-gray-0)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            lineHeight: 1,
            padding: 0,
          }}
          title={node.collapsed ? '展開' : '折りたたむ'}
        >
          {node.collapsed ? '▶' : '▼'}
        </button>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
});

MindMapNodeComponent.displayName = 'MindMapNodeComponent';
