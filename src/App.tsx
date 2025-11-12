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
  rebuscada: string;
}

interface ErrorResponse {
  detail: string;
}

  interface WhyNotResponse {
    raó: string;
    suggeriments: string[] | null;
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
    const [invalidWord, setInvalidWord] = useState<string | null>(null);
    const [showWhyNot, setShowWhyNot] = useState(false);
    const [whyNotData, setWhyNotData] = useState<WhyNotResponse | null>(null);
    const [loadingWhyNot, setLoadingWhyNot] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [lastGuess, setLastGuess] = useState<Intent | null>(null);
  const [formesCanoniquesProvades, setFormesCanoniquesProvades] = useState<Set<string>>(new Set());
  const [pistesDonades, setPistesDonades] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [rebuscadaActual, setRebuscadaActual] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [ranking, setRanking] = useState<{ paraula: string; posicio: number }[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [rankingTotal, setRankingTotal] = useState<number | null>(null);
  const [surrendered, setSurrendered] = useState(false);
  const [paraulaSolucio, setParaulaSolucio] = useState<string | null>(null);

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
  const getRebuscadaFromUrl = (): string | null => {
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
  const getRebuscadaFromServer = async (): Promise<string | null> => {
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
  const getCurrentRebuscada = async (): Promise<string> => {
    const urlWord = getRebuscadaFromUrl();
    if (urlWord) return urlWord;
    
    const serverWord = await getRebuscadaFromServer();
    return serverWord || 'default';
  };

  const rebuscada = getRebuscadaFromUrl();

  // Inicialitzar l'estat del joc
  useEffect(() => {
    const initializeGame = async () => {
      const currentWord = await getCurrentRebuscada();
      setRebuscadaActual(currentWord);
      
      const savedState = loadGameState();
      
      // Si hi ha estat guardat i la paraula del dia és la mateixa, carreguem l'estat
      if (savedState && savedState.rebuscada === currentWord) {
        setIntents(savedState.intents);
        setFormesCanoniquesProvades(new Set(savedState.formesCanoniquesProvades));
        setPistesDonades(savedState.pistesDonades);
        setGameWon(savedState.gameWon);
      } else if (savedState && savedState.rebuscada !== currentWord) {
        // Si la paraula ha canviat, netegem l'estat guardat
        clearGameState();
      }
    };

    initializeGame();
  }, []);

  // Guardar l'estat cada cop que canvien les dades importants
  useEffect(() => {
    if (rebuscadaActual) {
      const gameState: GameState = {
        intents,
        formesCanoniquesProvades: Array.from(formesCanoniquesProvades),
        pistesDonades,
        gameWon,
        rebuscada: rebuscadaActual
      };
      
      // Només guardem si hi ha algun intent o el joc s'ha guanyat
      if (intents.length > 0 || gameWon) {
        saveGameState(gameState);
      }
    }
  }, [intents, formesCanoniquesProvades, pistesDonades, gameWon, rebuscadaActual]);

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

  // Envia una paraula al backend (reutilitzat per submit i per clic de suggeriment)
  const submitWord = async (word: string) => {
    setError(null);
    const trimmed = (word || '').trim().toLowerCase();
    if (!trimmed) return;
    try {
      const requestBody: any = { paraula: trimmed };
      if (rebuscadaActual && rebuscadaActual !== 'default') {
        requestBody.rebuscada = rebuscadaActual;
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
        setInvalidWord(trimmed); // Guardem la paraula invàlida per /whynot
        setLastGuess(null); // Amaguem l'últim intent per mostrar l'error
        return; // Aturem l'execució aquí
      }

      // Si tot va bé, netegem la paraula invàlida
      setInvalidWord(null);

      // Comprovem si la forma canònica ja ha estat provada
      const formaCanonicaResultant = data.forma_canonica || data.paraula;
      if (formesCanoniquesProvades.has(formaCanonicaResultant)) {
        // Comprovem si és exactament la mateixa paraula que ja s'havia provat
        const paraulaJaProvada = intents.some(i => i.paraula === data.paraula);
        if (paraulaJaProvada) {
          setError(`Ja s'ha trobat "${data.paraula}".`);
        } else {
          // És una nova paraula però la seva forma canònica (arrel) ja s'havia trobat
          setError(`Ja s'ha trobat l'arrel de "${data.paraula}" (${formaCanonicaResultant}).`);
        }
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
        setParaulaSolucio(data.forma_canonica || data.paraula);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitWord(guess);
  };

    const handleWhyNot = async () => {
      if (!invalidWord) return;
    
      setLoadingWhyNot(true);
      setShowWhyNot(true);
      setWhyNotData(null);
    
      try {
        const requestBody: any = { paraula: invalidWord };
        if (rebuscadaActual && rebuscadaActual !== 'default') {
          requestBody.rebuscada = rebuscadaActual;
        }

        const response = await fetch(`${SERVER_URL}/whynot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
      
        if (!response.ok) {
          throw new Error('No s\'ha pogut obtenir l\'explicació');
        }
      
        const data: WhyNotResponse = await response.json();
        setWhyNotData(data);
      } catch (err) {
        console.error('Error obtenint explicació:', err);
        setWhyNotData({
          raó: 'No s\'ha pogut obtenir l\'explicació.',
          suggeriments: null
        });
      } finally {
        setLoadingWhyNot(false);
      }
    };

    const handleSuggestionClick = async (suggestion: string) => {
      setShowWhyNot(false);
      setError(null);
      setInvalidWord(null);
      await submitWord(suggestion);
    };

  const handlePista = async () => {
    setError(null);
    try {
      const requestBody: any = { intents: intents };
      if (rebuscadaActual && rebuscadaActual !== 'default') {
        requestBody.rebuscada = rebuscadaActual;
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
  setParaulaSolucio(newGuess.formaCanonica || newGuess.paraula);
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
      if (rebuscadaActual && rebuscadaActual !== 'default') {
        requestBody.rebuscada = rebuscadaActual;
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
      
  setParaulaSolucio(data.paraula_correcta);
      setGameWon(true);
      setLastGuess(null);
  setSurrendered(true);

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
          {surrendered ? (
            <h2>T'has rendit. La paraula era: <span className="solution-word" style={{color:'#2c3e50'}}>{paraulaSolucio}</span></h2>
          ) : (
            <h2>{paraulaSolucio ? <><span className="solution-word">{paraulaSolucio}</span> era la paraula rebuscada!</> : 'Has encertat la paraula rebuscada!'}</h2>
          )}
          <div className="stats">
            {(() => {
              // Comptar per color (mateixes condicions que getPosicioColor)
              const counters = { verd: 0, groc: 0, taronja: 0, vermell: 0, vermellFosc: 0 };
              intents.forEach(i => {
                if (i.posicio < 100) counters.verd++;
                else if (i.posicio < 250) counters.groc++;
                else if (i.posicio < 500) counters.taronja++;
                else if (i.posicio < 2000) counters.vermell++;
                else counters.vermellFosc++;
              });
              const total = intents.length || 1;
              return (
                <ul className="color-stats">
                  <li><span className="color-box" style={{ background: '#4caf50' }} /> <strong>{counters.verd}</strong> (&lt;100)</li>
                  <li><span className="color-box" style={{ background: '#ffc107' }} /> <strong>{counters.groc}</strong> (100-249)</li>
                  <li><span className="color-box" style={{ background: '#ff9800' }} /> <strong>{counters.taronja}</strong> (250-499)</li>
                  <li><span className="color-box" style={{ background: '#f44336' }} /> <strong>{counters.vermell}</strong> (500-1999)</li>
                  <li><span className="color-box" style={{ background: '#b71c1c' }} /> <strong>{counters.vermellFosc}</strong> (≥2000)</li>
                </ul>
              );
            })()}
            <p>Total intents: {intents.length} | Pistes utilitzades: {pistesDonades}</p>
          </div>
          <div className="win-actions">
            <button onClick={() => {
              clearGameState();
              window.location.reload();
            }}>Jugar de nou</button>
            <button onClick={async () => {
              setShowRanking(true);
              if (ranking.length === 0) {
                setLoadingRanking(true);
                setRankingError(null);
                try {
                  const params = rebuscadaActual && rebuscadaActual !== 'default' ? `?rebuscada=${encodeURIComponent(rebuscadaActual)}` : '';
                  const resp = await fetch(`${SERVER_URL}/ranking${params}`);
                  if (!resp.ok) throw new Error('No s\'ha pogut obtenir el rànquing');
                  const data = await resp.json();
                  setRanking(data.ranking || []);
                  setRankingTotal(data.total_paraules || null);
                } catch (e: any) {
                  setRankingError(e.message);
                } finally {
                  setLoadingRanking(false);
                }
              }
            }}>Veure top 300</button>
          </div>
          {showRanking && (
            <div className="ranking-modal" role="dialog" aria-modal="true">
              <div className="ranking-content">
                <h3>Top 300 {rebuscadaActual && rebuscadaActual !== 'default' ? `(${rebuscadaActual})` : ''}</h3>
                <button className="close" onClick={() => setShowRanking(false)}>×</button>
                {loadingRanking && <p>Carregant...</p>}
                {rankingError && <p className="error">{rankingError}</p>}
                {!loadingRanking && !rankingError && (
                  <ol className="ranking-list">
                    {ranking.map(item => {
                      const bgStyle = rankingTotal !== null ? getBackgroundStyle(item.posicio, rankingTotal) : undefined;
                      return (
                        <li 
                          key={item.paraula} 
                          className={item.posicio === 0 ? 'objectiu' : ''}
                          style={item.posicio === 0 ? undefined : bgStyle}
                        >
                          <span className="rank-pos" style={{color: item.posicio === 0 ? '#fff' : getPosicioColor(item.posicio)}}>
                            #{item.posicio}
                          </span>
                          <span>{item.paraula}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="intents">
        {!gameWon && (
          <div className="last-guess">
            {error ? (
              <div className="intent-item error-item">
                <span className="paraula">{error}</span>
                  {invalidWord && (
                    <button 
                      className="why-not-link" 
                      onClick={handleWhyNot}
                      aria-label="Per què no és vàlida?"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.496 6.033h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286a.237.237 0 0 0 .241.247m2.325 6.443c.61 0 1.029-.394 1.029-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94 0 .533.425.927 1.01.927z"></path>
                      </svg>
                    </button>
                  )}
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
        )}
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
      
        {/* Modal de Why Not */}
        {showWhyNot && (
          <div className="why-not-modal" role="dialog" aria-modal="true">
            <div className="why-not-content">
              <h3>Per què "{invalidWord}" no és vàlida?</h3>
              <button className="close" onClick={() => setShowWhyNot(false)}>×</button>
            
              {loadingWhyNot && <p>Carregant explicació...</p>}
            
              {!loadingWhyNot && whyNotData && (
                <>
                  <p className="explanation">{whyNotData.raó}</p>
                
                  {whyNotData.suggeriments && whyNotData.suggeriments.length > 0 && (
                    <div className="suggestions">
                      <h4>Potser volies dir:</h4>
                      <div className="suggestions-list">
                        {whyNotData.suggeriments.map((sugg, idx) => (
                          <button
                            key={idx}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(sugg)}
                          >
                            {sugg}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

export default App;
