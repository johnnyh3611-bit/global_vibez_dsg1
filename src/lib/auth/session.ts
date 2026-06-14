export const verifySession = async (token: string) => {
  if (!token) return { valid: false };
  return { valid: true };
};
