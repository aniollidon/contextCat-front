// Utilitats per gestionar múltiples jocs

export interface GameState {
  intents: any[];
  formesCanoniquesProvades: string[];
  pistesDonades: number;
  gameWon: boolean;
  rebuscada: string;
  gameId: number;
  surrendered: boolean;
}

export interface GameInfo {
  id: number;
  name: string;
  startDate?: string;
  today?: string;
}

// Converteix un número a números romans
export function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  
  let result = '';
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

// Converteix números romans a número
export function fromRoman(roman: string): number {
  const romanValues: Record<string, number> = {
    'I': 1, 'V': 5, 'X': 10, 'L': 50,
    'C': 100, 'D': 500, 'M': 1000
  };
  
  let result = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = romanValues[roman[i]];
    const next = romanValues[roman[i + 1]];
    
    if (next && current < next) {
      result -= current;
    } else {
      result += current;
    }
  }
  return result;
}

// Obté l'estat d'un joc (ABANDONAT, TROBADA, EN JOC)
export function getGameStatus(gameState: GameState | null): 'ABANDONAT' | 'TROBADA' | 'EN JOC' {
  if (!gameState) return 'EN JOC';
  if (gameState.surrendered) return 'ABANDONAT';
  if (gameState.gameWon) return 'TROBADA';
  return 'EN JOC';
}
