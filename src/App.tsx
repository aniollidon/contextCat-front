import React, { useState } from 'react';
import './App.css';

interface Intent {
  paraula: string;
  proximitat: number;
  esCorrecta: boolean;
  id: number;
}

interface ErrorResponse {
  detail: string;
}

interface Guess {
  word: string;
  proximity: number;
  isCorrect: boolean;
  arrel: string;
}

function App() {
  const [guess, setGuess] = useState('');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nextId, setNextId] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [gameWon, setGameWon] = useState(false);
  const [fadeOutIndex, setFadeOutIndex] = useState<number | null>(null);
  const [lastGuess, setLastGuess] = useState<Guess | null>(null);

  const getProximitatColor = (proximitat: number): string => {
    if (proximitat > 0.8) return '#4caf50'; // Verd
    if (proximitat > 0.6) return '#ff9800'; // Taronja
    if (proximitat > 0.4) return '#ffc107'; // Groc
    return '#f44336'; // Vermell
  };

  const getProximitatText = (proximitat: number): string => {
    if (proximitat > 0.8) return 'Molt proper!';
    if (proximitat > 0.6) return 'Proper';
    if (proximitat > 0.4) return 'Llunyà';
    return 'Molt llunyà';
  };

  const getBackgroundStyle = (proximitat: number) => {
    const color = getProximitatColor(proximitat);
    return {
      background: `linear-gradient(to right, ${color}22 ${proximitat * 100}%, rgba(255, 255, 255, 0.1) ${proximitat * 100}%)`,
      borderLeft: `4px solid ${color}`
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
        body: JSON.stringify({ word: trimmed })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Error inesperat');
      }
      
      const newGuess = {
        word: trimmed,
        proximity: data.proximitat,
        isCorrect: data.es_correcta,
        arrel: data.arrel
      };
      
      // Guardar l'últim intent
      setLastGuess(newGuess);
      
      // Afegir a la llista d'intents
      setGuesses(prev => [newGuess, ...prev].sort((a, b) => b.proximity - a.proximity));
      
      setGuess('');
      if (data.es_correcta) {
        setGameWon(true);
        alert('Felicitats! Has encertat la paraula!');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Hi ha hagut un error inesperat');
      }
    }
  };

  return (
    <div className="App">
      <h1>contextCAT</h1>
      {!gameWon ? (
        <header className="App-header">
          <div className="input-container">
            <div className="intent-count">intent: #{guesses.length}</div>
            <form onSubmit={handleSubmit}>
              <input
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
          {error && <div className="error">{error}</div>}
        </header>
      ) : (
        <div className="game-won">
          <h2>Felicitats! Has encertat la paraula!</h2>
          <button onClick={() => window.location.reload()}>Jugar de nou</button>
        </div>
      )}
      <div className="intents">
        {lastGuess && (
          <div className="last-guess">
            <div className="intent-item highlighted" style={getBackgroundStyle(lastGuess.proximity)}>
              <span className="paraula">
                {lastGuess.word}
                {lastGuess.word !== lastGuess.arrel && ` (${lastGuess.arrel})`}
              </span>
              <div className="proximitat-info">
                <span 
                  className="proximitat-text"
                  style={{ color: getProximitatColor(lastGuess.proximity) }}
                >
                  {getProximitatText(lastGuess.proximity)}
                </span>
                <span className="proximitat-valor">
                  {(lastGuess.proximity * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
        <ul>
          {guesses.map((guess, idx) => (
            <li 
              key={idx} 
              className={`intent-item ${guess.isCorrect ? 'correct' : ''} ${guess === lastGuess ? 'highlighted' : ''}`}
              style={getBackgroundStyle(guess.proximity)}
            >
              <span className="paraula">
                {guess.word}
                {guess.word !== guess.arrel && ` (${guess.arrel})`}
              </span>
              <div className="proximitat-info">
                <span 
                  className="proximitat-text"
                  style={{ color: getProximitatColor(guess.proximity) }}
                >
                  {getProximitatText(guess.proximity)}
                </span>
                <span className="proximitat-valor">
                  {(guess.proximity * 100).toFixed(1)}%
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
