import { Redirect } from "expo-router";
import { useSession } from "@/app/_layout";

export default function Index() {
  const { session } = useSession();
  return session ? <Redirect href="/(app)/obras" /> : <Redirect href="/(auth)/login" />;
}
