export function generateConfigId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  const letter1 = letters[Math.floor(Math.random() * letters.length)];
  const digit = numbers[Math.floor(Math.random() * numbers.length)];
  const letter2 = letters[Math.floor(Math.random() * letters.length)];
  
  let digits = '';
  for (let i = 0; i < 11; i++) {
    digits += numbers[Math.floor(Math.random() * numbers.length)];
  }
  
  return `${letter1}${digit}${letter2}${digits}`;
}