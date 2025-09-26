import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { UserProfile } from '../types/user';

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false);
  const userProfile = ref<UserProfile | null>(null);
  const auth = getAuth();

  let hasInitialized = false;

  const loadUser = async (): Promise<void> => {
    if (hasInitialized) return;
    hasInitialized = true;

    return new Promise((resolve) => {
      console.log('Attempting to load user...');
      onAuthStateChanged(auth, async (user: User | null) => {
        console.log('Auth state changed:', user);

        isLoggedIn.value = !!user;

        if (user) {
          try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
              userProfile.value = userDoc.data() as UserProfile;
            } else {
              const plainUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
              };
              await setDoc(userRef, plainUser);
              userProfile.value = plainUser as UserProfile;
            }
          } catch (err) {
            console.error('[UserStore] Failed to load user document:', err);
          }
        } else {
          userProfile.value = null;
        }

        resolve();
      });
    });
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();

      await setPersistence(auth, browserLocalPersistence);

      const result = await signInWithPopup(auth, provider);

      const user = result.user;
      console.log('Google 登录成功:', user);

      isLoggedIn.value = !!user;
      userProfile.value = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        const plainUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        await setDoc(userRef, plainUser);
      }

      console.log('用户信息已保存到 Firestore');
    } catch (error) {
      console.error('Google 登录失败:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      userProfile.value = null;
      isLoggedIn.value = false;
    } catch (error) {
      console.error('退出失败:', error);
      throw error;
    }
  };

  return {
    isLoggedIn,
    userProfile,
    loginWithGoogle,
    logout,
    loadUser,
  };
});
