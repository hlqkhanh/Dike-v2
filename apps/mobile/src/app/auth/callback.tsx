import { Redirect } from "expo-router";

// The in-flight browser auth session validates and exchanges the callback code.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
