import React, { useState, useEffect } from 'react';
import './App.css';

interface Intent {
  paraula: string;
  formaCanonica: string | null;
  posicio: number;
  totalParaules: number;
  esCorrecta: boolean;
  esPista?: boolean;
}

interface GameState {
  intents: Intent[];
  formesCanoniquesProvades: string[];
  pistesDonades: number;
  gameWon: boolean;
  paraulaDia: string;
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

interface PistaResponse {
  paraula: string;
  forma_canonica: string | null;
  posicio: number;
  total_paraules: number;
}

// Constant per la URL del servidor (des de variables d'entorn)
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:8000';

// Clau per localStorage
const GAME_STATE_KEY = 'rebuscada-game-state';

function App() {
  const [guess, setGuess] = useState('');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gameWon, setGameWon] = useState(false);
  const [lastGuess, setLastGuess] = useState<Intent | null>(null);
  const [formesCanoniquesProvades, setFormesCanoniquesProvades] = useState<Set<string>>(new Set());
  const [pistesDonades, setPistesDonades] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [paraulaDiaActual, setParaulaDiaActual] = useState<string | null>(null);

  // Funcions per gestionar localStorage
  const saveGameState = (gameState: GameState) => {
    try {
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    } catch (error) {
      console.warn('Error guardant l\'estat del joc:', error);
    }
  };

  const loadGameState = (): GameState | null => {
    try {
      const saved = localStorage.getItem(GAME_STATE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Error carregant l\'estat del joc:', error);
      return null;
    }
  };

  const clearGameState = () => {
    try {
      localStorage.removeItem(GAME_STATE_KEY);
    } catch (error) {
      console.warn('Error netejant l\'estat del joc:', error);
    }
  };

  // Obtenir la paraula del dia de l'URL (decodificada des de Base64)
  const getParaulaDiaFromUrl = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedWord = urlParams.get('word');
    if (!encodedWord) return null;
    
    try {
      // Decodificar des de Base64
      const decodedWord = atob(encodedWord);
      return decodedWord;
    } catch (error) {
      console.warn('Error decodificant la paraula Base64:', error);
      return null;
    }
  };

  // Obtenir la paraula del dia del servidor
  const getParaulaDiaFromServer = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${SERVER_URL}/paraula-dia`);
      if (response.ok) {
        const data = await response.json();
        return data.paraula || null;
      }
    } catch (error) {
      console.warn('Error obtenint la paraula del dia del servidor:', error);
    }
    return null;
  };

  // Obtenir la paraula del dia actual (prioritzant URL sobre servidor)
  const getCurrentParaulaDia = async (): Promise<string> => {
    const urlWord = getParaulaDiaFromUrl();
    if (urlWord) return urlWord;
    
    const serverWord = await getParaulaDiaFromServer();
    return serverWord || 'default';
  };

  const paraulaDia = getParaulaDiaFromUrl();

  // Inicialitzar l'estat del joc
  useEffect(() => {
    const initializeGame = async () => {
      const currentWord = await getCurrentParaulaDia();
      setParaulaDiaActual(currentWord);
      
      const savedState = loadGameState();
      
      // Si hi ha estat guardat i la paraula del dia és la mateixa, carreguem l'estat
      if (savedState && savedState.paraulaDia === currentWord) {
        setIntents(savedState.intents);
        setFormesCanoniquesProvades(new Set(savedState.formesCanoniquesProvades));
        setPistesDonades(savedState.pistesDonades);
        setGameWon(savedState.gameWon);
      } else if (savedState && savedState.paraulaDia !== currentWord) {
        // Si la paraula ha canviat, netegem l'estat guardat
        clearGameState();
      }
    };

    initializeGame();
  }, []);

  // Guardar l'estat cada cop que canvien les dades importants
  useEffect(() => {
    if (paraulaDiaActual) {
      const gameState: GameState = {
        intents,
        formesCanoniquesProvades: Array.from(formesCanoniquesProvades),
        pistesDonades,
        gameWon,
        paraulaDia: paraulaDiaActual
      };
      
      // Només guardem si hi ha algun intent o el joc s'ha guanyat
      if (intents.length > 0 || gameWon) {
        saveGameState(gameState);
      }
    }
  }, [intents, formesCanoniquesProvades, pistesDonades, gameWon, paraulaDiaActual]);

  const getPosicioColor = (posicio: number): string => {
    if (posicio < 100) return '#4caf50'; // Verd
    if (posicio < 250) return '#ffc107'; // Groc
    if (posicio < 500) return '#ff9800'; // Taronja
    if (posicio < 2000) return '#f44336'; // Vermell
    return '#b71c1c'; // Vermell fosc
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
      const requestBody: any = { paraula: trimmed };
      if (paraulaDiaActual && paraulaDiaActual !== 'default') {
        requestBody.paraula_dia = paraulaDiaActual;
      }

      const response = await fetch(`${SERVER_URL}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data: GuessResponse = await response.json();
      if (!response.ok) {
        // Si l'error ve de l'API, el guardem i evitem netejar l'input
        const errorData = data as any;
        setError(errorData.detail || 'Error inesperat');
        setLastGuess(null); // Amaguem l'últim intent per mostrar l'error
        return; // Aturem l'execució aquí
      }
      
      // Comprovem si la forma canònica ja ha estat provada
      const formaCanonicaResultant = data.forma_canonica || data.paraula;
      if (formesCanoniquesProvades.has(formaCanonicaResultant)) {
        setError(`Ja has provat "${formaCanonicaResultant}".`);
        setLastGuess(null);
        setGuess(''); // Buidem l'input en aquest cas específic
        return; // No processem l'intent repetit
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
      setFormesCanoniquesProvades(prev => new Set(prev).add(formaCanonicaResultant));
      
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

  const handlePista = async () => {
    setError(null);
    try {
      const requestBody: any = { intents: intents };
      if (paraulaDiaActual && paraulaDiaActual !== 'default') {
        requestBody.paraula_dia = paraulaDiaActual;
      }

      const response = await fetch(`${SERVER_URL}/pista`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data: PistaResponse = await response.json();

      if (!response.ok) {
        const errorData = data as any;
        setError(errorData.detail || 'Error en demanar la pista');
        setLastGuess(null);
        return;
      }
      
      const formaCanonicaResultant = data.forma_canonica || data.paraula;
      if (formesCanoniquesProvades.has(formaCanonicaResultant)) {
        setError(`La pista "${formaCanonicaResultant}" ja s'havia provat.`);
        setLastGuess(null);
        return; 
      }
      
      const newGuess: Intent = {
        paraula: data.paraula,
        formaCanonica: data.forma_canonica,
        posicio: data.posicio,
        totalParaules: data.total_paraules,
        esCorrecta: data.posicio === 0,
        esPista: true
      };
      
      setLastGuess(newGuess);
      setIntents(prev => [newGuess, ...prev].sort((a, b) => a.posicio - b.posicio));
      setFormesCanoniquesProvades(prev => new Set(prev).add(formaCanonicaResultant));
      setPistesDonades(prev => prev + 1);

      if (newGuess.esCorrecta) {
        setGameWon(true);
      }

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Hi ha hagut un error de xarxa inesperat');
      }
      setLastGuess(null);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownPista = () => {
    setIsDropdownOpen(false);
    handlePista();
  };

  const handleRendirse = async () => {
    setIsDropdownOpen(false);
    try {
      const requestBody: any = {};
      if (paraulaDiaActual && paraulaDiaActual !== 'default') {
        requestBody.paraula_dia = paraulaDiaActual;
      }

      const response = await fetch(`${SERVER_URL}/rendirse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Error en rendir-se');
      }

      const data = await response.json();
      
      setError(`La paraula era: ${data.paraula_correcta}`);
      setGameWon(true);
      setLastGuess(null);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Hi ha hagut un error de xarxa inesperat');
      }
    }
  };

  // Tancar el dropdown quan es clica fora
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-menu')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="App">
      <h1>Rebuscada</h1>
      {!gameWon ? (
        <header className="App-header">
          <div className="input-container">
            <div className="intent-count">Intents: {intents.length} | Pistes: {pistesDonades}</div>
            <form onSubmit={handleSubmit}>
              <input id="guess-input"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Escriu una paraula..."
                disabled={gameWon}
                autoComplete="off"
              />
              <button type="submit" disabled={gameWon}>
                Comprovar
              </button>
              <div className="dropdown-menu">
                <button 
                  type="button" 
                  className="dropdown-toggle"
                  onClick={toggleDropdown}
                  disabled={gameWon}
                  aria-label="Menú d'opcions"
                >
                  ⋮
                </button>
                <div className={`dropdown-content ${isDropdownOpen ? 'show' : ''}`}>
                  <button 
                    type="button"
                    className="dropdown-item"
                    onClick={handleDropdownPista}
                    disabled={gameWon}
                  >
                    Pista
                  </button>
                  <button 
                    type="button"
                    className="dropdown-item"
                    onClick={handleRendirse}
                    disabled={gameWon}
                  >
                    Rendir-se
                  </button>
                </div>
              </div>
            </form>
          </div>
        </header>
      ) : (
        <div className="game-won">
          <h2>Felicitats! Has encertat la paraula!</h2>
          <button onClick={() => {
            clearGameState();
            window.location.reload();
          }}>Jugar de nou</button>
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
                <span className="proximitat-valor" style={{ color: getPosicioColor(lastGuess.posicio) }}>
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
                <span className="proximitat-valor" style={{ color: getPosicioColor(intent.posicio) }}>
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
