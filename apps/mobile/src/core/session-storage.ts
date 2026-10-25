import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Web preview keeps credentials only for the lifetime of the browser tab.
export const sessionStorage = {
  getItemAsync: async (key: string) =>
    Platform.OS === "web"
      ? typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(key)
      : SecureStore.getItemAsync(key),
  setItemAsync: async (key: string, value: string) => {
    if (Platform.OS === "web") window.sessionStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync: async (key: string) => {
    if (Platform.OS === "web") window.sessionStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
