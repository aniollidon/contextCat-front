import React, { useState } from 'react';
import './App.css';

interface Intent {
  paraula: string;
  formaCanonica: string | null;
  posicio: number;
  totalParaules: number;
  esCorrecta: boolean;
}

interface ErrorResponse {
  detail: string;
}

interface GuessResponse {
  paraula: string;
  forma_canonica: string | null;
  posicio: number;
  total_paraules: number;
  es_correcta: boolean;
  detail?: string;
}

function App() {
  const [guess, setGuess] = useState('');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gameWon, setGameWon] = useState(false);
  const [lastGuess, setLastGuess] = useState<Intent | null>(null);

  const getPosicioColor = (posicio: number): string => {
    if (posicio < 25) return '#4caf50'; // Verd
    if (posicio < 50) return '#ffc107'; // Groc
    if (posicio < 500) return '#ff9800'; // Taronja
    return '#f44336'; // Vermell
  };

  const getPosicioText = (posicio: number): string => {
    if (posicio === 0) return 'Perfecte!';
    if (posicio < 25) return 'Molt a prop';
    if (posicio < 50) return 'A prop';
    if (posicio < 500) return 'Llunyà';
    return 'Molt llunyà';
  };

  const getBackgroundStyle = (posicio: number, totalParaules: number) => {
    // Escala logarítmica per al percentatge de la barra.
    // Això fa que les diferències a les posicions baixes siguin més visibles.
    // Si posicio és 0, el percentatge és 100%.
    // S'utilitza log(posicio + 1) per evitar log(0).
    const percentatge = posicio === 0
      ? 1
      : Math.max(0, 1 - (Math.log(posicio + 1) / Math.log(totalParaules)));

    const color = getPosicioColor(posicio);
    return {
      background: `linear-gradient(to right, ${color}22 ${percentatge * 100}%, rgba(255, 255, 255, 0.1) ${percentatge * 100}%)`
    } as React.CSSProperties;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = guess.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const response = await fetch('http://localhost:8000/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paraula: trimmed })
      });
      const data: GuessResponse = await response.json();
      if (!response.ok) {
        // Si l'error ve de l'API, el guardem i evitem netejar l'input
        const errorData = data as any;
        setError(errorData.detail || 'Error inesperat');
        setLastGuess(null); // Amaguem l'últim intent per mostrar l'error
        return; // Aturem l'execució aquí
      }
      
      const newGuess: Intent = {
        paraula: data.paraula,
        formaCanonica: data.forma_canonica,
        posicio: data.posicio,
        totalParaules: data.total_paraules,
        esCorrecta: data.es_correcta
      };
      
      setLastGuess(newGuess);
      setIntents(prev => [newGuess, ...prev].sort((a, b) => a.posicio - b.posicio));
      
      setGuess('');
      if (data.es_correcta) {
        setGameWon(true);
      }
    } catch (err) {
      // Aquest catch és per a errors de xarxa, no per a respostes de l'API
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Hi ha hagut un error de xarxa inesperat');
      }
      setLastGuess(null); // Amaguem l'últim intent també en aquests errors
    }
  };

  return (
    <div className="App">
      <h1>contextCAT</h1>
      {!gameWon ? (
        <header className="App-header">
          <div className="input-container">
            <div className="intent-count">Intents: {intents.length}</div>
            <form onSubmit={handleSubmit}>
              <input id="guess-input"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Escriu una paraula..."
                disabled={gameWon}
              />
              <button type="submit" disabled={gameWon}>
                Comprovar
              </button>
            </form>
          </div>
        </header>
      ) : (
        <div className="game-won">
          <h2>Felicitats! Has encertat la paraula!</h2>
          <button onClick={() => window.location.reload()}>Jugar de nou</button>
        </div>
      )}
      <div className="intents">
        <div className="last-guess">
          {error ? (
            <div className="intent-item error-item">
              <span className="paraula">{error}</span>
            </div>
          ) : lastGuess && (
            <div className="intent-item highlighted" style={getBackgroundStyle(lastGuess.posicio, lastGuess.totalParaules)}>
              <span className="paraula">
                {lastGuess.paraula}
                {lastGuess.formaCanonica && ` (${lastGuess.formaCanonica})`}
              </span>
              <div className="proximitat-info">
                <span 
                  className="proximitat-text"
                  style={{ color: getPosicioColor(lastGuess.posicio) }}
                >
                  {getPosicioText(lastGuess.posicio)}
                </span>
                <span className="proximitat-valor">
                  #{lastGuess.posicio}
                </span>
              </div>
            </div>
          )}
        </div>
        <ul>
          {intents.map((intent, idx) => (
            <li 
              key={idx} 
              className={`intent-item ${intent.esCorrecta ? 'correct' : ''} ${intent === lastGuess ? 'highlighted' : ''}`}
              style={getBackgroundStyle(intent.posicio, intent.totalParaules)}
            >
              <span className="paraula">
                {intent.paraula}
                {intent.formaCanonica && ` (${intent.formaCanonica})`}
              </span>
              <div className="proximitat-info">
                <span 
                  className="proximitat-text"
                  style={{ color: getPosicioColor(intent.posicio) }}
                >
                  {getPosicioText(intent.posicio)}
                </span>
                <span className="proximitat-valor">
                  #{intent.posicio}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
