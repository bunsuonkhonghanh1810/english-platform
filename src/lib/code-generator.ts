const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateExamCode(length = 6): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return result;
}
