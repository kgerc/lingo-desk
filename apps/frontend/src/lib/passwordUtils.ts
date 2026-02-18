export const generateSecurePassword = (length = 12): string => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;
  const cryptoObj = window.crypto || (window as any).msCrypto;
  const getRandomChar = (chars: string) =>
    chars[cryptoObj.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const passwordChars = [
    getRandomChar(upper), getRandomChar(lower),
    getRandomChar(digits), getRandomChar(special),
  ];
  while (passwordChars.length < length) passwordChars.push(getRandomChar(all));
  return passwordChars.sort(() => 0.5 - Math.random()).join('');
};
