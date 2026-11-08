let refreshPromise: Promise<boolean> | null = null;

async function requestSessionRefresh(): Promise<boolean> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.ok;
}

export function refreshSessionOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = requestSessionRefresh()
      .then((result) => {
        return result;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function fetchWithSessionRefresh(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const firstResponse = await fetch(input, {
    ...init,
    credentials: "same-origin",
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshed = await refreshSessionOnce();

  if (!refreshed) {
    return firstResponse;
  }

  return fetch(input, {
    ...init,
    credentials: "same-origin",
  });
}