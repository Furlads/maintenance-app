// lib/auth/client.ts
export async function apiFetch(input: string, init: RequestInit = {}) {
  // Always use relative URLs so we stay on the same origin (localhost vs LAN IP)
  const url = input.startsWith("/") ? input : `/${input}`;

  return fetch(url, {
    ...init,
    // This is the KEY: send/receive cookies for same-origin requests
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}