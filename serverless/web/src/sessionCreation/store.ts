import { nanoid } from 'nanoid';
import type { CreateSessionRequest, CreateSessionResponse } from '../contracts/sessionCreation';

export interface SessionCreationState {
  title: string;
  facilitatorName: string;
  notionDbId: string;
  connectionCap: number;
  publicView: boolean;
  status: 'idle' | 'submitting' | 'success' | 'error';
  errors: Record<string, string>;
  result?: CreateSessionResponse;
}

interface SessionCreationFields {
  title: string;
  facilitatorName: string;
  notionDbId: string;
  connectionCap: number;
  publicView: boolean;
}

interface SessionCreationStoreDeps {
  endpoint: string;
  fetch: typeof fetch;
  persistIdentity: (sessionId: string, identity: { userId: string; name: string; joinToken: string; dbId?: string | null }) => void;
  now?: () => Date;
}

export interface SessionCreationStore {
  getState(): SessionCreationState;
  updateField(field: keyof SessionCreationFields, value: SessionCreationFields[typeof field]): void;
  submit(): Promise<{ ok: true; response: CreateSessionResponse } | { ok: false; errors: Record<string, string> }>;
  subscribe(listener: (state: SessionCreationState) => void): () => void;
}

const DEFAULT_STATE: SessionCreationState = {
  title: '',
  facilitatorName: '',
  notionDbId: '',
  connectionCap: 10,
  publicView: false,
  status: 'idle',
  errors: {},
};

export const createSessionCreationStore = (deps: SessionCreationStoreDeps): SessionCreationStore => {
  const listeners = new Set<(state: SessionCreationState) => void>();
  let state: SessionCreationState = { ...DEFAULT_STATE };

  const notify = () => listeners.forEach((listener) => listener(state));

  const updateState = (patch: Partial<SessionCreationState>) => {
    state = { ...state, ...patch };
    notify();
  };

  const updateField = <K extends keyof SessionCreationFields>(field: K, value: SessionCreationFields[K]) => {
    state = { ...state, [field]: value };
    notify();
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!state.title.trim()) {
      errors.title = 'セッションタイトルを入力してください。';
    }
    if (!state.facilitatorName.trim()) {
      errors.facilitatorName = 'ファシリテーター名を入力してください。';
    }
    if (state.connectionCap <= 0) {
      errors.connectionCap = '接続上限は 1 以上で入力してください。';
    }
    return errors;
  };

  const buildRequest = (): CreateSessionRequest => {
    const facilitatorId = `host_${nanoid(8)}`;
    const payload: CreateSessionRequest = {
      title: state.title.trim(),
      facilitator: {
        id: facilitatorId,
        name: state.facilitatorName.trim(),
      },
      connectionCap: state.connectionCap,
      publicView: state.publicView,
    };
    if (state.notionDbId.trim()) {
      payload.backlogSource = { notionDbId: state.notionDbId.trim() };
    }
    return payload;
  };

  const submit: SessionCreationStore['submit'] = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      updateState({ errors, status: 'error' });
      return { ok: false, errors };
    }

    updateState({ status: 'submitting', errors: {} });
    const payload = buildRequest();
    const requestBody = JSON.stringify(payload);

    try {
      const response = await deps.fetch(`${deps.endpoint}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      const json = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        const message = typeof json.message === 'string' ? json.message : 'セッションの作成に失敗しました。';
        const fieldErrors: Record<string, string> = { global: message };
        updateState({ status: 'error', errors: fieldErrors });
        return { ok: false, errors: fieldErrors };
      }
      const result = json as CreateSessionResponse;
      deps.persistIdentity(result.sessionId, {
        userId: payload.facilitator.id,
        name: payload.facilitator.name,
        joinToken: result.joinToken,
        dbId: state.notionDbId.trim() || null,
      });
      updateState({ status: 'success', result });
      return { ok: true, response: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ネットワークエラーが発生しました。';
      const err = { global: message };
      updateState({ status: 'error', errors: err });
      return { ok: false, errors: err };
    }
  };

  const subscribe: SessionCreationStore['subscribe'] = (listener) => {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  };

  return {
    getState: () => state,
    updateField,
    submit,
    subscribe,
  };
};
