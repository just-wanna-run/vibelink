import { create } from 'zustand';
import api, { setStoredToken, getStoredToken, clearStoredToken } from '../services/api';
import { generateAesKey, encryptKeyWithPassword, decryptKeyWithPassword, storeKeyLocally, loadKeyLocally, clearLocalKey } from '../services/crypto';
import { setEncryptionKey } from './encryptionStore';

interface User {
  userId: string;
  email: string | null;
  phone: string | null;
  publicKey?: string;
  encryptedPrivateKey?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isCheckingToken: boolean; // true while verifying stored token on app start

  login: (params: { email?: string; phone?: string; password: string; rememberMe?: boolean }) => Promise<void>;
  register: (params: { email?: string; phone?: string; password: string }) => Promise<void>;
  sendCode: (phone: string) => Promise<void>;
  loginWithCode: (params: { phone: string; code: string; rememberMe?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  checkStoredToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isCheckingToken: true,

  login: async ({ email, phone, password, rememberMe }) => {
    set({ isLoading: true });
    try {
      // Save credentials if rememberMe
      // Always save credentials for pre-fill (regardless of rememberMe)
      localStorage.setItem('vibelink_saved_email', email || '');
      localStorage.setItem('vibelink_saved_phone', phone || '');

      // Detect device type roughly
      const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const deviceName = deviceType === 'mobile' ? '手机' : '电脑';

      const { data } = await api.post('/auth/login', {
        email: email || undefined,
        phone: phone || undefined,
        password,
        rememberMe: !!rememberMe,
        deviceName,
        deviceType,
      });

      // Decrypt encryption key from server (graceful fallback if crypto fails)
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
            api.post('/auth/register', {
              email: email || undefined,
              phone: phone || undefined,
              password,
              encryptedPrivateKey: newEncrypted,
            }).catch(() => {});
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
          email: data.email,
          phone: data.phone,
          publicKey: data.publicKey,
          encryptedPrivateKey: data.encryptedPrivateKey,
        },
        token: data.token,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      const msg = err.response?.data?.error || '登录失败';
      throw new Error(msg);
    }
  },

  register: async ({ email, phone, password }) => {
    set({ isLoading: true });
    try {
      const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const deviceName = deviceType === 'mobile' ? '手机' : '电脑';

      // Generate encryption key and encrypt with password for server storage
      let encryptedKey: string | undefined;
      try {
        const aesKey = await generateAesKey();
        encryptedKey = await encryptKeyWithPassword(aesKey, password);
        setEncryptionKey(aesKey);
        storeKeyLocally(aesKey);
      } catch (cryptoErr) {
        // If crypto fails, proceed without encryption (degraded mode)
        console.warn('Encryption setup failed, proceeding without E2E:', cryptoErr);
      }

      const { data } = await api.post('/auth/register', {
        email: email || undefined,
        phone: phone || undefined,
        password,
        deviceName,
        deviceType,
        encryptedPrivateKey: encryptedKey || undefined,
      });

      // Save credentials on register too
      localStorage.setItem('vibelink_saved_email', email || '');
      localStorage.setItem('vibelink_saved_phone', phone || '');
      localStorage.setItem('vibelink_saved_password', password);

      setStoredToken(data.token, true); // auto-remember on register
      set({
        user: {
          userId: data.userId,
          email: data.email,
          phone: data.phone,
        },
        token: data.token,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      const msg = err.response?.data?.error || '注册失败';
      throw new Error(msg);
    }
  },

  sendCode: async (phone: string) => {
    try {
      const { data } = await api.post('/auth/send-code', { phone });
      // Dev mode: show code directly
      if (data.code) {
        // Copy to clipboard and alert
        navigator.clipboard?.writeText(data.code);
        alert(`验证码：${data.code}\n（已自动复制到剪贴板）`);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || '发送验证码失败');
    }
  },

  loginWithCode: async ({ phone, code, rememberMe }) => {
    set({ isLoading: true });
    try {
      const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const deviceName = deviceType === 'mobile' ? '手机' : '电脑';

      const { data } = await api.post('/auth/login-with-code', {
        phone,
        code,
        rememberMe: !!rememberMe,
        deviceName,
        deviceType,
      });

      setStoredToken(data.token, !!rememberMe);

      // Try to load encryption key from server or locally
      if (data.encryptedPrivateKey) {
        try {
          const key = await loadKeyLocally();
          if (key) setEncryptionKey(key);
        } catch {}
      }

      set({
        user: {
          userId: data.userId,
          email: data.email,
          phone: data.phone,
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

  logout: async () => {
    const token = get().token || getStoredToken();
    try {
      if (token) {
        await api.post('/auth/logout', { token });
      }
    } catch {
      // ignore network errors on logout
    }
    clearStoredToken();
    clearLocalKey();
    setEncryptionKey(null);
    // Don't clear saved credentials on logout — user might want to log back in
    set({ user: null, token: null });
  },

  checkStoredToken: async () => {
    set({ isCheckingToken: true });
    try {
      const token = getStoredToken();
      if (!token) {
        set({ isCheckingToken: false });
        return false;
      }

      const { data } = await api.post('/auth/verify-token', { token });

      // Try to load encryption key from local storage
      try {
        const localKey = await loadKeyLocally();
        if (localKey) setEncryptionKey(localKey);
      } catch {}

      setStoredToken(data.token, true);
      set({
        user: {
          userId: data.userId,
          email: data.email,
          phone: data.phone,
          publicKey: data.publicKey,
          encryptedPrivateKey: data.encryptedPrivateKey,
        },
        token: data.token,
        isCheckingToken: false,
      });
      return true;
    } catch (err: any) {
      // Only clear token on auth error (401), keep it on network errors
      if (err?.response?.status === 401) {
        clearStoredToken();
        set({ isCheckingToken: false, user: null, token: null });
      } else {
        // Network error — keep token, try again next time
        set({ isCheckingToken: false });
        // Still allow the user to manually log in
        if (get().user === null) {
          // No previous user, so stay on login page
        }
      }
      return false;
    }
  },
}));
