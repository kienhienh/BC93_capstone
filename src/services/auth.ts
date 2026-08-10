const TOKEN_KEY = "token";
const CLIENT_ID_KEY = "clientId";

export const saveAuthSession = (token: string, clientId: number) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CLIENT_ID_KEY, clientId.toString());
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CLIENT_ID_KEY);
};

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);

export const getClientId = (): number | null => {
  const storedId = localStorage.getItem(CLIENT_ID_KEY);
  if (!storedId) return null;

  const clientId = Number(storedId);
  return Number.isInteger(clientId) ? clientId : null;
};
