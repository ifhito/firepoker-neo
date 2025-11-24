import type { ProductBacklogItem } from '../domain/pbi';

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'closed';

export interface SelectionState {
  target?: ProductBacklogItem;
  point: number | '';
  memo: string;
}

export interface UpdateGuard {
  disabled: boolean;
  message: string | null;
}

const isPointValid = (point: number | ''): point is number =>
  typeof point === 'number' && Number.isFinite(point) && point >= 0;

export const synchronizeSelection = (
  selection: SelectionState,
  items: ProductBacklogItem[],
): SelectionState => {
  if (items.length === 0) {
    return { ...selection, target: undefined };
  }

  if (selection.target) {
    const stillExists = items.find((item) => item.id === selection.target?.id);
    if (stillExists) {
      return { ...selection, target: stillExists };
    }
  }

  return { ...selection, target: items[0] };
};

export const calculateUpdateState = (
  status: ConnectionStatus,
  selection: SelectionState,
): UpdateGuard => {
  if (status !== 'connected') {
    return { disabled: true, message: '接続が完了するまで操作を待機しています' };
  }
  if (!selection.target) {
    return { disabled: true, message: 'PBIを選択してください' };
  }
  if (!isPointValid(selection.point)) {
    return { disabled: true, message: 'ストーリーポイントを入力してください' };
  }
  return { disabled: false, message: null };
};
