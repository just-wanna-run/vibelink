import { create } from 'zustand';
import api, { setStoredToken, getStoredToken, clearStoredToken } from '../services/api';
import { generateAesKey, encryptKeyWithPassword, decryptKeyWithPassword, storeKeyLocally, loadKeyLocally, clearLocalKey } from '../services/crypto';
import { setEncryptionKey } from './encryptionStore';

interface User {
  userId: string;
  username: string;
  recoveryEmail?: string;
  publicKey?: string;
  encryptedPrivateKey?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isCheckingToken: boolean;

  login: (params: { username: string; password: string; rememberMe?: boolean }) => Promise<void>;
  register: (params: { username: string; password: string; recoveryEmail: string; emailCode: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkStoredToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isCheckingToken: true,

  login: async ({ username, password, rememberMe }) => {
    set({ isLoading: true });
    try {
      if (rememberMe) {
        localStorage.setItem('vibelink_saved_username', username);
      }

      const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const deviceName = deviceType === 'mobile' ? '手机' : '电脑';

      const { data } = await api.post('/auth/login', {
        username, password,
        rememberMe: !!rememberMe,
        deviceName, deviceType,
      });

      if (data.encryptedPrivateKey) {
        try {
          const aesKey = await decryptKeyWithPassword(data.encryptedPrivateKey, password);
          setEncryptionKey(aesKey);
          if (rememberMe) storeKeyLocally(aesKey);
        } catch {
          console.warn('Key decryption failed, will generate new key');
          try {
            const newKey = await generateAesKey();
            setEncryptionKey(newKey);
            const newEncrypted = await encryptKeyWithPassword(newKey, password);
            api.post('/auth/register', { username, password, encryptedPrivateKey: newEncrypted }).catch(() => {});
            if (rememberMe) storeKeyLocally(newKey);
          } catch (cryptoErr) {
            console.warn('Crypto unavailable, proceeding without E2E:', cryptoErr);
          }
        }
      }

      setStoredToken(data.token, !!rememberMe);
      set({
        user: {
          userId: data.userId,
          username: data.username,
          recoveryEmail: data.recoveryEmail,
          publicKey: data.publicKey,
          encryptedPrivateKey: data.encryptedPrivateKey,
        },
        token: data.token,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error || '登录失败');
    }
  },

  register: async ({ username, password, recoveryEmail, emailCode }) => {
    set({ isLoading: true });
    try {
      const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const deviceName = deviceType === 'mobile' ? '手机' : '电脑';

      let encryptedKey: string | undefined;
      try {
        const aesKey = await generateAesKey();
        setEncryptionKey(aesKey);
        storeKeyLocally(aesKey);
        encryptedKey = await encryptKeyWithPassword(aesKey, password);
      } catch (cryptoErr) {
        console.warn('Encryption setup failed, proceeding without E2E:', cryptoErr);
      }

      const { data } = await api.post('/auth/register', {
        username, password,
        recoveryEmail,
        emailCode,
        deviceName, deviceType,
        encryptedPrivateKey: encryptedKey || undefined,
      });

      localStorage.setItem('vibelink_saved_username', username);
      localStorage.setItem('vibelink_saved_password', password);

      setStoredToken(data.token, true);
      set({
        user: { userId: data.userId, username: data.username, recoveryEmail: data.recoveryEmail },
        token: data.token,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error || '注册失败');
    }
  },

  logout: async () => {
    const token = get().token || getStoredToken();
    try {
      if (token) await api.post('/auth/logout', { token });
    } catch {}
    clearStoredToken();
    clearLocalKey();
    setEncryptionKey(null);
    set({ user: null, token: null });
  },

  checkStoredToken: async () => {
    set({ isCheckingToken: true });
    try {
      const token = getStoredToken();
      if (!token) { set({ isCheckingToken: false }); return false; }

      const { data } = await api.post('/auth/verify-token', { token });

      try {
        const localKey = await loadKeyLocally();
        if (localKey) setEncryptionKey(localKey);
      } catch {}

      setStoredToken(data.token, true);
      set({
        user: {
          userId: data.userId,
          username: data.username,
          recoveryEmail: data.recoveryEmail,
          publicKey: data.publicKey,
          encryptedPrivateKey: data.encryptedPrivateKey,
        },
        token: data.token,
        isCheckingToken: false,
      });
      return true;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        clearStoredToken();
        set({ isCheckingToken: false, user: null, token: null });
      } else {
        set({ isCheckingToken: false });
      }
      return false;
    }
  },
}));
