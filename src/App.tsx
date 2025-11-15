import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Intent {
  paraula: string;
  forma_canonica: string | null;
  posicio: number;
  total_paraules: number;
  es_correcta: boolean;
  es_pista?: boolean;
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

interface PlayerCompetition {
  nom: string;
  intents: number;
  pistes: number;
  estat_joc: string;  // "jugant", "guanyat" o "rendit"
  millor_posicio: number | null;
}

interface CompetitionInfo {
  comp_id: string;
  rebuscada: string;
  nom_jugador: string;
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

// Claus per localStorage
const GAME_STATE_KEY = 'rebuscada-game-state';
const COMPETITION_KEY = 'rebuscada-competition';

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  // Estats per mode competitiu
  const [showCompetitionModal, setShowCompetitionModal] = useState(false);
  const [showCompetitionExplanation, setShowCompetitionExplanation] = useState(false);
  const [competitionInfo, setCompetitionInfo] = useState<CompetitionInfo | null>(null);
  const [competitionPlayers, setCompetitionPlayers] = useState<PlayerCompetition[]>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showSwitchCompetition, setShowSwitchCompetition] = useState(false);
  const [pendingCompId, setPendingCompId] = useState<string | null>(null);
  const [showExpiredCompetition, setShowExpiredCompetition] = useState(false);

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

  const saveCompetitionInfo = (info: CompetitionInfo) => {
    try {
      localStorage.setItem(COMPETITION_KEY, JSON.stringify(info));
    } catch (error) {
      console.warn('Error guardant info de competició:', error);
    }
  };

  const loadCompetitionInfo = (): CompetitionInfo | null => {
    try {
      const saved = localStorage.getItem(COMPETITION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Error carregant info de competició:', error);
      return null;
    }
  };

  const clearCompetitionInfo = () => {
    try {
      localStorage.removeItem(COMPETITION_KEY);
    } catch (error) {
      console.warn('Error netejant info de competició:', error);
    }
  };

  const resetGameState = () => {
    setIntents([]);
    setFormesCanoniquesProvades(new Set());
    setPistesDonades(0);
    setGameWon(false);
    setLastGuess(null);
    setSurrendered(false);
    setParaulaSolucio(null);
    setError(null);
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

  // Obtenir l'ID de competició de la URL
  const getCompIdFromUrl = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('comp');
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
      
      // Comprovar si estem en mode competició
      const compId = getCompIdFromUrl();
      const savedCompInfo = loadCompetitionInfo();
      
      // Si la paraula ha canviat i tenim competició guardada, sortir de la competició
      if (savedCompInfo && savedCompInfo.rebuscada !== currentWord) {
        clearCompetitionInfo();
        if (wsConnection) {
          wsConnection.close();
          setWsConnection(null);
        }
        setCompetitionInfo(null);
        setCompetitionPlayers([]);
      }
      
      if (compId) {
        // Mode competició des d'URL
        if (savedCompInfo && savedCompInfo.comp_id === compId && savedCompInfo.rebuscada === currentWord) {
          // Ja tenim info guardada d'aquesta competició amb la mateixa paraula
          setCompetitionInfo(savedCompInfo);
          await joinCompetitionWebSocket(compId);
        } else if (savedCompInfo && savedCompInfo.comp_id !== compId) {
          // Diferent competició - preguntar si vol canviar
          setPendingCompId(compId);
          setShowSwitchCompetition(true);
        } else {
          // Nova competició o paraula diferent, comprovar si existeix primer
          const exists = await loadCompetitionState(compId);
          if (exists) {
            setShowNamePrompt(true);
          } else {
            // Competició caducada
            setShowExpiredCompetition(true);
          }
        }
      } else if (savedCompInfo && savedCompInfo.rebuscada === currentWord) {
        // No hi ha compId a URL però tenim competició guardada vàlida - recuperar
        setCompetitionInfo(savedCompInfo);
        await joinCompetitionWebSocket(savedCompInfo.comp_id);
        // Actualitzar URL per reflectir la competició
        const newUrl = `${window.location.pathname}?comp=${savedCompInfo.comp_id}`;
        window.history.pushState({}, '', newUrl);
      }
      
      const savedState = loadGameState();
      
      // Si hi ha estat guardat i la paraula del dia és la mateixa, carreguem l'estat
      if (savedState && savedState.rebuscada === currentWord) {
        setIntents(savedState.intents);
        setFormesCanoniquesProvades(new Set(savedState.formesCanoniquesProvades));
        setPistesDonades(savedState.pistesDonades);
        setGameWon(savedState.gameWon);
      } else if (savedState && savedState.rebuscada !== currentWord) {
        // Si la paraula ha canviat, netegem l'estat guardat i l'estat de React
        console.log(`Paraula canviada - netejant estat anterior (${savedState.rebuscada} -> ${currentWord})`);
        clearGameState();
        resetGameState();
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

  const loadCompetitionState = async (compId: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/competition/${compId}`);
      if (response.ok) {
        const data = await response.json();
        const players = Object.values(data.jugadors) as PlayerCompetition[];
        setCompetitionPlayers(players);
        console.log('Jugadors carregats via HTTP:', players);
        return true;
      } else if (response.status === 404) {
        // Competició no trobada (probablement caducada)
        return false;
      }
    } catch (error) {
      console.error('Error carregant estat de competició:', error);
    }
    return false;
  };

  const joinCompetitionWebSocket = async (compId: string) => {
    // Primer, carregar l'estat via HTTP
    const exists = await loadCompetitionState(compId);
    if (!exists) {
      // Competició caducada
      setShowExpiredCompetition(true);
      clearCompetitionInfo();
      return;
    }

    try {
      // Tancar connexió anterior si n'hi ha
      if (wsConnection) {
        wsConnection.close();
      }

      const wsUrl = SERVER_URL.replace('http', 'ws').replace('https', 'wss') + `/ws/competition/${compId}`;
      console.log('Intentant connectar WebSocket a:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connectat a competició:', compId);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket missatge rebut:', data);
        if (data.type === 'init' || data.type === 'update') {
          console.log('Actualitzant jugadors:', data.jugadors);
          setCompetitionPlayers(data.jugadors);
        }
      };

      ws.onerror = (error) => {
        console.error('Error WebSocket:', error);
        console.log('WebSocket fallit, però jugadors ja carregats via HTTP');
      };

      ws.onclose = () => {
        console.log('WebSocket desconnectat');
        setWsConnection(null);
      };

      setWsConnection(ws);
    } catch (error) {
      console.error('Error connectant WebSocket:', error);
    }
  };

  const handleCreateCompetition = async () => {
    if (!playerName.trim()) {
      setError('Has d\'introduir un nom');
      return;
    }

    try {
      const response = await fetch(`${SERVER_URL}/competition/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom_creador: playerName.trim(),
          rebuscada: rebuscadaActual,
          intents_existents: intents.map(i => ({
            paraula: i.paraula,
            forma_canonica: i.forma_canonica,
            posicio: i.posicio,
            total_paraules: i.total_paraules,
            es_correcta: i.es_correcta
          }))
        })
      });

      if (!response.ok) {
        throw new Error('No s\'ha pogut crear la competició');
      }

      const data = await response.json();
      const compInfo: CompetitionInfo = {
        comp_id: data.comp_id,
        rebuscada: data.rebuscada,
        nom_jugador: playerName.trim()
      };

      setCompetitionInfo(compInfo);
      saveCompetitionInfo(compInfo);

      // Actualitzar URL
      const newUrl = `${window.location.pathname}?comp=${data.comp_id}`;
      window.history.pushState({}, '', newUrl);

      // Connectar WebSocket
      await joinCompetitionWebSocket(data.comp_id);

      // Tancar modal d'explicació i mostrar modal de compartir
      setShowCompetitionExplanation(false);
      setShowCompetitionModal(true);
    } catch (error) {
      setError('Error creant la competició');
      console.error(error);
    }
  };

  const handleJoinCompetition = async (compId: string, name: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/competition/${compId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom_jugador: name.trim(),
          intents_existents: intents.map(i => ({
            paraula: i.paraula,
            forma_canonica: i.forma_canonica,
            posicio: i.posicio,
            total_paraules: i.total_paraules,
            es_correcta: i.es_correcta
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'No s\'ha pogut unir a la competició');
      }

      const data = await response.json();
      const compInfo: CompetitionInfo = {
        comp_id: data.comp_id,
        rebuscada: data.rebuscada,
        nom_jugador: name.trim()
      };

      setCompetitionInfo(compInfo);
      saveCompetitionInfo(compInfo);
      
      // Si la paraula és diferent, netejar els intents
      if (rebuscadaActual && data.rebuscada !== rebuscadaActual) {
        console.log(`Paraula canviada de '${rebuscadaActual}' a '${data.rebuscada}' - netejant intents`);
        resetGameState();
        clearGameState();
      }
      
      setRebuscadaActual(data.rebuscada);

      // Connectar WebSocket
      await joinCompetitionWebSocket(compId);

      setShowNamePrompt(false);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Error unint-se a la competició');
      }
      console.error(error);
    }
  };

  const handleLeaveCompetition = async () => {
    if (!competitionInfo) return;

    try {
      const response = await fetch(
        `${SERVER_URL}/competition/${competitionInfo.comp_id}/leave?nom_jugador=${encodeURIComponent(competitionInfo.nom_jugador)}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('No s\'ha pogut sortir de la competició');
      }

      // Tancar WebSocket
      if (wsConnection) {
        wsConnection.close();
        setWsConnection(null);
      }

      // Netejar estat de competició
      clearCompetitionInfo();
      setCompetitionInfo(null);
      setCompetitionPlayers([]);

      // Eliminar comp_id de la URL
      const newUrl = window.location.pathname;
      window.history.pushState({}, '', newUrl);

      setShowLeaveConfirm(false);
    } catch (error) {
      setError('Error sortint de la competició');
      console.error(error);
    }
  };

  const handleSwitchCompetition = async () => {
    // Sortir de la competició actual
    if (competitionInfo) {
      try {
        await fetch(
          `${SERVER_URL}/competition/${competitionInfo.comp_id}/leave?nom_jugador=${encodeURIComponent(competitionInfo.nom_jugador)}`,
          { method: 'POST' }
        );
      } catch (error) {
        console.error('Error sortint de competició anterior:', error);
      }

      // Tancar WebSocket
      if (wsConnection) {
        wsConnection.close();
        setWsConnection(null);
      }
    }

    // Netejar estat
    clearCompetitionInfo();
    setCompetitionInfo(null);
    setCompetitionPlayers([]);

    // Mostrar prompt per unir-se a la nova competició
    setShowSwitchCompetition(false);
    setShowNamePrompt(true);
  };

  const sortPlayers = (players: PlayerCompetition[]): PlayerCompetition[] => {
    return [...players].sort((a, b) => {
      // Rendits van al final
      if (a.estat_joc === "rendit" && b.estat_joc !== "rendit") return 1;
      if (a.estat_joc !== "rendit" && b.estat_joc === "rendit") return -1;
      
      // Si tots dos són rendits, ordenar per intents (menys intents primer)
      if (a.estat_joc === "rendit" && b.estat_joc === "rendit") {
        if (a.intents !== b.intents) return a.intents - b.intents;
        return a.pistes - b.pistes;
      }
      
      // Ordenar per millor posició (més baix és millor)
      const posA = a.millor_posicio ?? Infinity;
      const posB = b.millor_posicio ?? Infinity;
      
      if (posA !== posB) return posA - posB;
      
      // En cas d'empat, per menys pistes
      if (a.pistes !== b.pistes) return a.pistes - b.pistes;
      
      // En cas d'empat, per menys intents
      return a.intents - b.intents;
    });
  };

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
  const submitWord = async (word: string, options?: { keepInput?: boolean }) => {
    const keepInput = options?.keepInput ?? false;
    setError(null);
    const trimmed = (word || '').trim().toLowerCase();
    if (!trimmed) return;
    try {
      const requestBody: any = { paraula: trimmed };
      if (rebuscadaActual && rebuscadaActual !== 'default') {
        requestBody.rebuscada = rebuscadaActual;
      }
      if (competitionInfo) {
        requestBody.comp_id = competitionInfo.comp_id;
        requestBody.nom_jugador = competitionInfo.nom_jugador;
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
        if (!keepInput) {
          setGuess(''); // Buidem l'input en aquest cas específic
        } else {
          setGuess(word);
        }
        return; // No processem l'intent repetit
      }

      const newGuess: Intent = {
        paraula: data.paraula,
        forma_canonica: data.forma_canonica,
        posicio: data.posicio,
        total_paraules: data.total_paraules,
        es_correcta: data.es_correcta
      };

      setLastGuess(newGuess);
      setIntents(prev => [newGuess, ...prev].sort((a, b) => a.posicio - b.posicio));
      setFormesCanoniquesProvades(prev => new Set(prev).add(formaCanonicaResultant));

      if (!keepInput) {
        setGuess('');
      } else {
        setGuess(word);
      }
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
      setGuess(suggestion);
      // Porta el focus a l'input i selecciona tot
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
      await submitWord(suggestion, { keepInput: true });
    };

    const handleInputFocus = () => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    };

  const handlePista = async () => {
    setError(null);
    try {
      const requestBody: any = { intents: intents };
      if (rebuscadaActual && rebuscadaActual !== 'default') {
        requestBody.rebuscada = rebuscadaActual;
      }
      if (competitionInfo) {
        requestBody.comp_id = competitionInfo.comp_id;
        requestBody.nom_jugador = competitionInfo.nom_jugador;
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
        forma_canonica: data.forma_canonica,
        posicio: data.posicio,
        total_paraules: data.total_paraules,
        es_correcta: data.posicio === 0,
        es_pista: true
      };
      
      setLastGuess(newGuess);
      setIntents(prev => [newGuess, ...prev].sort((a, b) => a.posicio - b.posicio));
      setFormesCanoniquesProvades(prev => new Set(prev).add(formaCanonicaResultant));
      setPistesDonades(prev => prev + 1);

      if (newGuess.es_correcta) {
  setGameWon(true);
  setParaulaSolucio(newGuess.forma_canonica || newGuess.paraula);
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
      if (competitionInfo) {
        requestBody.comp_id = competitionInfo.comp_id;
        requestBody.nom_jugador = competitionInfo.nom_jugador;
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

  // Tancar connexió WebSocket quan es desmunta el component
  React.useEffect(() => {
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [wsConnection]);

  // Reiniciar estat de linkCopied quan es tanca el modal
  React.useEffect(() => {
    if (!showCompetitionModal) {
      setLinkCopied(false);
    }
  }, [showCompetitionModal]);

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
                ref={inputRef}
                onFocus={handleInputFocus}
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
                  <button 
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      if (competitionInfo) {
                        setShowCompetitionModal(true);
                      } else {
                        setShowCompetitionExplanation(true);
                      }
                    }}
                  >
                    Crea competició
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
              <div className="intent-item highlighted" style={getBackgroundStyle(lastGuess.posicio, lastGuess.total_paraules)}>
                <span className="paraula">
                  {lastGuess.paraula}
                  {lastGuess.forma_canonica && ` (${lastGuess.forma_canonica})`}
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
              className={`intent-item ${intent.es_correcta ? 'correct' : ''} ${intent === lastGuess ? 'highlighted' : ''}`}
              style={getBackgroundStyle(intent.posicio, intent.total_paraules)}
            >
              <span className="paraula">
                {intent.paraula}
                {intent.forma_canonica && ` (${intent.forma_canonica})`}
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

      {/* Sidebar de competició */}
      {competitionInfo && (
        <div className="competition-sidebar">
          <div className="sidebar-header">
            <h3>Competició</h3>
            <button 
              className="close-competition-btn"
              onClick={() => setShowLeaveConfirm(true)}
              aria-label="Sortir de la competició"
            >
              ×
            </button>
          </div>
          {competitionPlayers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#7f8c8d', padding: '1rem' }}>
              Carregant jugadors...
            </p>
          ) : (
            <ul className="competition-players compact">
              {sortPlayers(competitionPlayers).map((player, idx) => (
                <li key={idx} className={player.nom === competitionInfo.nom_jugador ? 'current-player' : ''}>
                  <span className="player-name">{player.nom}</span>
                  {player.millor_posicio !== null && (
                    <span 
                      className="player-position" 
                      style={{ color: getPosicioColor(player.millor_posicio) }}
                    >
                      #{player.millor_posicio}
                    </span>
                  )}
                  <span className="player-info">
                    ({player.intents}i{player.pistes > 0 && `, ${player.pistes}p`})
                  </span>
                  {player.estat_joc === "guanyat" && <span className="player-won"> ✓</span>}
                  {player.estat_joc === "rendit" && <span className="player-surrendered"> ✗</span>}
                </li>
              ))}
            </ul>
          )}
          <button 
            className="add-players-btn"
            onClick={() => setShowCompetitionModal(true)}
          >
            + Afegir jugadors
          </button>
        </div>
      )}

      {/* Modal d'explicació del mode competitiu */}
      {showCompetitionExplanation && (
        <div className="competition-modal" role="dialog" aria-modal="true">
          <div className="competition-content">
            <h3>Mode Competitiu</h3>
            <button className="close" onClick={() => setShowCompetitionExplanation(false)}>×</button>
            <div className="explanation-text">
              <p>
                El <strong>mode competitiu</strong> et permet competir amb els teus amics per veure qui 
                troba la paraula rebuscada amb menys intents!
              </p>
              <ul>
                <li>Es juga amb la paraula del dia actual</li>
                <li>Comparteix l'enllaç amb els teus amics</li>
                <li>Veuràs els seus progressos en temps real</li>
                <li>Si ja estaves jugant, els teus intents es mantenen</li>
              </ul>
              <p>Escriu el teu nom per començar:</p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="El teu nom..."
                maxLength={20}
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={handleCreateCompetition} disabled={!playerName.trim()}>
                  Crear Competició
                </button>
                <button onClick={() => setShowCompetitionExplanation(false)} className="cancel">
                  Cancel·lar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal per mostrar l'enllaç de competició */}
      {showCompetitionModal && competitionInfo && (
        <div className="competition-modal" role="dialog" aria-modal="true">
          <div className="competition-content share-link-modal">
            <h3> Comparteix per competir</h3>
            <button className="close" onClick={() => setShowCompetitionModal(false)}>×</button>
            <p className="share-instructions">
              Envia aquest enllaç als teus amics perquè puguin unir-se a la competició:
            </p>
            <div className="competition-link">
              <input
                type="text"
                value={`${window.location.origin}${window.location.pathname}?comp=${competitionInfo.comp_id}`}
                readOnly
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                className={linkCopied ? 'copied' : ''}
                onClick={() => {
                  const link = `${window.location.origin}${window.location.pathname}?comp=${competitionInfo.comp_id}`;
                  navigator.clipboard.writeText(link);
                  setLinkCopied(true);
                  setTimeout(() => {
                    setLinkCopied(false);
                  }, 2000);
                }}
              >
                {linkCopied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0"/>
                      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
                      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
                    </svg>
                    <span>Copiat!</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
                      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
                    </svg>
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <button onClick={() => setShowCompetitionModal(false)} className="ok-button">
              D'acord
            </button>
          </div>
        </div>
      )}

      {/* Modal competició caducada */}
      {showExpiredCompetition && (
        <div className="competition-modal" role="dialog" aria-modal="true">
          <div className="competition-content">
            <h3>Competició caducada</h3>
            <p>
              La competició a la que vols accedir ha caducat. Ens sap greu...
            </p>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowExpiredCompetition(false);
                  // Netejar URL de competició
                  window.history.pushState({}, '', window.location.pathname);
                }}
                className="primary"
              >
                Juga en mode normal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt per unir-se a competició */}
      {showNamePrompt && (
        <div className="competition-modal" role="dialog" aria-modal="true">
          <div className="competition-content">
            <h3>Unir-se a Competició</h3>
            <p>Introdueix el teu nom per unir-te a aquesta competició:</p>
            {error && <div className="error">{error}</div>}
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setError(null); // Netejar error quan l'usuari escriu
              }}
              placeholder="El teu nom..."
              maxLength={20}
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter' && playerName.trim()) {
                  const compId = getCompIdFromUrl();
                  if (compId) {
                    handleJoinCompetition(compId, playerName);
                  }
                }
              }}
            />
            <div className="modal-actions">
              <button
                onClick={() => {
                  const compId = getCompIdFromUrl();
                  if (compId) {
                    handleJoinCompetition(compId, playerName);
                  }
                }}
                disabled={!playerName.trim()}
              >
                Unir-se
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmació sortida de competició */}
      {showLeaveConfirm && (
        <div className="competition-modal" role="dialog" aria-modal="true">
          <div className="competition-content">
            <h3>Sortir de la competició?</h3>
            <p>
              Si surts de la competició, els altres jugadors ja no veuran el teu progrés.
              Les paraules que has endevinat es mantindran.
            </p>
            <div className="modal-actions">
              <button onClick={handleLeaveCompetition} className="danger">
                Sortir
              </button>
              <button onClick={() => setShowLeaveConfirm(false)} className="cancel">
                Cancel·lar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal canvi de competició */}
      {showSwitchCompetition && (
        <div className="competition-modal" role="dialog" aria-modal="true">
          <div className="competition-content">
            <h3>Canviar de competició?</h3>
            <p>
              Ja estàs participant en una competició. Vols sortir-ne i unir-te a aquesta nova competició?
            </p>
            <div className="modal-actions">
              <button onClick={handleSwitchCompetition}>
                Canviar
              </button>
              <button 
                onClick={() => {
                  setShowSwitchCompetition(false);
                  setPendingCompId(null);
                }} 
                className="cancel"
              >
                Cancel·lar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
