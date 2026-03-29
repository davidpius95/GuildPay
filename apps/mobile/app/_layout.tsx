import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30000 },
  },
});

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F5F5F5" },
          animation: "slide_from_right",
        }}
      >
        {/* Auth screens */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        {/* Main app (tab navigation) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Modal screens */}
        <Stack.Screen name="send" options={{ presentation: "card" }} />
        <Stack.Screen name="receive" options={{ presentation: "card" }} />
        <Stack.Screen name="wallet" options={{ presentation: "card" }} />
      </Stack>
    </QueryClientProvider>
  );
}
