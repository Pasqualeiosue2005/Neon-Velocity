import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { GameState, PowerUpType, PowerUpLevels, CarConfig, Language, Mission, MissionType } from './types';
import { GAME_CONFIG, CAR_MODELS, SCALING_CONFIG, UPGRADE_COSTS } from './constants';
import { audioManager } from './utils/AudioManager';

const REVIVE_COST = 1000;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [menuState, setMenuState] = useState<'HOME' | 'GARAGE' | 'UPGRADES' | 'SETTINGS' | 'SHOP'>('HOME');

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Economy State
  const [credits, setCredits] = useState(0);
  const [gems, setGems] = useState(0); // New Premium Currency
  const [unlockedCars, setUnlockedCars] = useState<string[]>([CAR_MODELS[0].id]);

  // Refs to track currency for async callbacks to prevent stale closures
  const creditsRef = useRef(0);
  const gemsRef = useRef(0);

  // Customization State
  const [carConfigs, setCarConfigs] = useState<Record<string, CarConfig>>({});

  const [selectedCarIndex, setSelectedCarIndex] = useState(0);
  const [runCredits, setRunCredits] = useState(0); // Credits collected in current run
  const [runGems, setRunGems] = useState(0);       // Gems collected in current run
  const [multiplier, setMultiplier] = useState(1); // Progressive multiplier

  // Upgrades State (Global Powerups)
  const [powerUpLevels, setPowerUpLevels] = useState<PowerUpLevels>({
    SHIELD: 1,
    MAGNET: 1
  });

  // HUD State - Dictionary for multiple active powerups with remaining time
  const [activePowerUps, setActivePowerUps] = useState<Record<string, number>>({});
  const [missions, setMissions] = useState<Mission[]>([]);
  const [showMissions, setShowMissions] = useState(false); // UI Toggle
  const [lastMissionDate, setLastMissionDate] = useState<string>('');
  const [currentSpeed, setCurrentSpeed] = useState(SCALING_CONFIG.startSpeed);

  // Speed is managed here to persist/reset correctly but driven by Canvas loop
  const gameSpeedRef = useRef(SCALING_CONFIG.startSpeed);
  const isRevivingRef = useRef(false);

  // Track credits already added to bank during this run (to prevent double counting on revive)
  const bankedRunCreditsRef = useRef(0);
  const bankedRunGemsRef = useRef(0);

  // Settings State
  const [language, setLanguage] = useState<Language>('EN');
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [sfxVolume, setSfxVolume] = useState(0.5);

  // MISSIONS LOGIC
  const generateDailyMissions = useCallback(() => {
    const newMissions: Mission[] = [
      {
        id: 'm_coins_' + Date.now(),
        type: MissionType.COLLECT_COINS,
        description: 'Collect 500 Credits in one run',
        target: 500,
        progress: 0,
        completed: false,
        claimed: false,
        reward: 10
      },
      {
        id: 'm_score_' + Date.now(),
        type: MissionType.SCORE_POINTS,
        description: 'Score 50,000 points in one run',
        target: 50000,
        progress: 0,
        completed: false,
        claimed: false,
        reward: 15
      },
      {
        id: 'm_mult_' + Date.now(),
        type: MissionType.REACH_MULTIPLIER,
        description: 'Reach 10x Multiplier',
        target: 10,
        progress: 0,
        completed: false,
        claimed: false,
        reward: 20
      }
    ];
    setMissions(newMissions);
    localStorage.setItem('neon-velocity-missions', JSON.stringify(newMissions));
    const today = new Date().toDateString();
    setLastMissionDate(today);
    localStorage.setItem('neon-velocity-mission-date', today);
  }, []);

  // Load Data
  useEffect(() => {
    const savedScore = localStorage.getItem('neon-velocity-highscore');
    if (savedScore) setHighScore(parseInt(savedScore, 10));

    const savedCredits = localStorage.getItem('neon-velocity-credits');
    if (savedCredits) {
      const c = parseInt(savedCredits, 10);
      setCredits(c);
      creditsRef.current = c;
    }

    const savedGems = localStorage.getItem('neon-velocity-gems');
    if (savedGems) {
      const g = parseInt(savedGems, 10);
      // DEV: Ensure user has gems
      if (g < 2000) {
        setGems(2000);
        gemsRef.current = 2000;
        localStorage.setItem('neon-velocity-gems', '2000');
      } else {
        setGems(g);
        gemsRef.current = g;
      }
    } else {
      // New user or no gems saved -> Start with 2000
      setGems(2000);
      gemsRef.current = 2000;
      localStorage.setItem('neon-velocity-gems', '2000');
    }

    const savedUnlocks = localStorage.getItem('neon-velocity-unlocks');
    if (savedUnlocks) {
      try {
        setUnlockedCars(JSON.parse(savedUnlocks));
      } catch (e) {
        console.error("Failed to parse unlocks", e);
      }
    }

    const savedLevels = localStorage.getItem('neon-velocity-powerups');
    if (savedLevels) {
      try {
        setPowerUpLevels(JSON.parse(savedLevels));
      } catch (e) {
        console.error("Failed to parse levels", e);
      }
    }

    const savedConfigs = localStorage.getItem('neon-velocity-configs');
    if (savedConfigs) {
      try {
        setCarConfigs(JSON.parse(savedConfigs));
      } catch (e) {
        console.error("Failed to parse car configs", e);
      }
    }

    // Load Settings
    const savedLang = localStorage.getItem('neon-velocity-lang');
    if (savedLang) setLanguage(savedLang as Language);

    const savedMusicVol = localStorage.getItem('neon-velocity-music-vol');
    if (savedMusicVol) {
      const v = parseFloat(savedMusicVol);
      setMusicVolume(v);
      audioManager.setMusicVolume(v);
    }

    const savedSfxVol = localStorage.getItem('neon-velocity-sfx-vol');
    if (savedSfxVol) {
      const v = parseFloat(savedSfxVol);
      setSfxVolume(v);
      audioManager.setSfxVolume(v);
      audioManager.setSfxVolume(v); // Redundant call in original, removed
    }

    // Load Missions
    const savedDate = localStorage.getItem('neon-velocity-mission-date');
    const today = new Date().toDateString();
    if (savedDate !== today) {
      generateDailyMissions();
    } else {
      const savedMissions = localStorage.getItem('neon-velocity-missions');
      if (savedMissions) {
        try {
          setMissions(JSON.parse(savedMissions));
          setLastMissionDate(savedDate);
        } catch (e) { generateDailyMissions(); }
      } else {
        generateDailyMissions();
      }
    }
  }, [generateDailyMissions]);

  // Sync refs when state changes
  useEffect(() => {
    creditsRef.current = credits;
  }, [credits]);

  useEffect(() => {
    gemsRef.current = gems;
  }, [gems]);

  // Save Data helpers
  const saveCredits = (newCredits: number) => {
    setCredits(newCredits);
    creditsRef.current = newCredits;
    localStorage.setItem('neon-velocity-credits', newCredits.toString());
  };

  const saveGems = (newGems: number) => {
    setGems(newGems);
    gemsRef.current = newGems;
    localStorage.setItem('neon-velocity-gems', newGems.toString());
  };



  const checkMissions = (runCreds: number, runScore: number, runMult: number) => {
    const updatedMissions = missions.map(m => {
      if (m.completed) return m;
      let newProgress = m.progress;
      if (m.type === MissionType.COLLECT_COINS) {
        newProgress = runCreds; // Single run target or cumulative? Description says "in one run", so simple.
        if (newProgress >= m.target) return { ...m, progress: m.target, completed: true };
      }
      else if (m.type === MissionType.SCORE_POINTS) {
        if (runScore >= m.target) return { ...m, progress: runScore, completed: true };
        else return { ...m, progress: Math.max(m.progress, runScore) }; // Best score kept
      }
      else if (m.type === MissionType.REACH_MULTIPLIER) {
        if (runMult >= m.target) return { ...m, progress: runMult, completed: true };
        else return { ...m, progress: Math.max(m.progress, runMult) };
      }
      return m;
    });
    // If changed, update
    if (JSON.stringify(updatedMissions) !== JSON.stringify(missions)) {
      setMissions(updatedMissions);
      localStorage.setItem('neon-velocity-missions', JSON.stringify(updatedMissions));
    }
  };

  const claimMissionReward = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (mission && mission.completed && !mission.claimed) {
      saveGems(gems + mission.reward);
      const updated = missions.map(m => m.id === missionId ? { ...m, claimed: true } : m);
      setMissions(updated);
      localStorage.setItem('neon-velocity-missions', JSON.stringify(updated));
      audioManager.play('coin'); // Or custom sound
    }
  };

  const saveCarConfigs = (newConfigs: Record<string, CarConfig>) => {
    setCarConfigs(newConfigs);
    localStorage.setItem('neon-velocity-configs', JSON.stringify(newConfigs));
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('neon-velocity-lang', lang);
  };

  const handleSetMusicVolume = (vol: number) => {
    setMusicVolume(vol);
    audioManager.setMusicVolume(vol);
    localStorage.setItem('neon-velocity-music-vol', vol.toString());
  };

  const handleSetSfxVolume = (vol: number) => {
    setSfxVolume(vol);
    audioManager.setSfxVolume(vol);
    localStorage.setItem('neon-velocity-sfx-vol', vol.toString());
  };

  const [resetKey, setResetKey] = useState(0);

  const handleStart = () => {
    // Security check: Ensure we own the car
    const selectedCar = CAR_MODELS[selectedCarIndex];
    if (!unlockedCars.includes(selectedCar.id)) {
      return; // Do nothing if locked
    }

    // Start Music on first real interaction
    audioManager.playBGM();

    setRunCredits(0);
    setRunGems(0);
    bankedRunCreditsRef.current = 0; // Reset banked credits for new run
    bankedRunGemsRef.current = 0;
    setActivePowerUps({});
    setMultiplier(1);
    setCurrentSpeed(SCALING_CONFIG.startSpeed);
    // Reset speed
    gameSpeedRef.current = SCALING_CONFIG.startSpeed;
    isRevivingRef.current = false;

    // Force GameCanvas reset
    setResetKey(prev => prev + 1);
    setGameState(GameState.PLAYING);
  };

  const handleRevive = () => {
    if (credits >= REVIVE_COST) {
      saveCredits(credits - REVIVE_COST);
      isRevivingRef.current = true;
      setGameState(GameState.PLAYING);
      audioManager.startEngine();
    }
  };

  const handleRestart = () => {
    // Restart the match immediately
    handleStart();
  };

  const handlePause = () => {
    if (gameState === GameState.PLAYING) {
      setGameState(GameState.PAUSED);
      audioManager.stopEngine();
    }
  };

  const handleResume = () => {
    if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
      audioManager.startEngine();
    }
  };

  const handleQuit = () => {
    setGameState(GameState.START);
    setMenuState('HOME');
    audioManager.stopEngine();
  };

  const handleGameOver = (finalState: GameState) => {
    if (finalState === GameState.GAME_OVER) {
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('neon-velocity-highscore', score.toString());
      }

      // Calculate only the NEW credits earned since the last crash/save
      const newCreditsToBank = runCredits - bankedRunCreditsRef.current;
      const newGemsToBank = runGems - bankedRunGemsRef.current;

      // CRITICAL FIX: Use refs to access latest balance to prevent stale closure overwrites
      if (newCreditsToBank > 0) {
        const totalCredits = creditsRef.current + newCreditsToBank;
        saveCredits(totalCredits);
        bankedRunCreditsRef.current = runCredits;
      }
      if (newGemsToBank > 0) {
        const totalGems = gemsRef.current + newGemsToBank;
        saveGems(totalGems);
        bankedRunGemsRef.current = runGems;
      }
    }
    setGameState(finalState);
  };

  // Optimized: Receives the calculated amount directly from GameCanvas
  const handleCoinCollect = useCallback((amount: number) => {
    setRunCredits(prev => prev + amount);
  }, []);

  // Gems are NOT multiplied
  const handleGemCollect = useCallback(() => {
    setRunGems(prev => prev + 1);
  }, []);

  const handleBuyCar = (carId: string, cost: number) => {
    if (unlockedCars.includes(carId)) return;

    // Find car model to check currency type
    const carModel = CAR_MODELS.find(c => c.id === carId);
    if (!carModel) return;

    if (carModel.currency === 'GEMS') {
      // Gem Purchase
      if (gems >= cost) {
        const newGems = gems - cost;
        const newUnlocks = [...unlockedCars, carId];
        saveGems(newGems);
        setUnlockedCars(newUnlocks);
        localStorage.setItem('neon-velocity-unlocks', JSON.stringify(newUnlocks));
      }
    } else {
      // Credit Purchase (Default)
      if (credits >= cost) {
        const newCredits = credits - cost;
        const newUnlocks = [...unlockedCars, carId];
        saveCredits(newCredits);
        setUnlockedCars(newUnlocks);
        localStorage.setItem('neon-velocity-unlocks', JSON.stringify(newUnlocks));
      }
    }
  };

  const handleUpgradePowerUp = (type: PowerUpType) => {
    const currentLevel = powerUpLevels[type];
    const cost = currentLevel * 5; // 5, 10, 15, 20 Gems...

    if (gems >= cost && currentLevel < 5) { // Max level 5
      const newGems = gems - cost;
      const newLevels = { ...powerUpLevels, [type]: currentLevel + 1 };

      saveGems(newGems);
      setPowerUpLevels(newLevels);
      localStorage.setItem('neon-velocity-powerups', JSON.stringify(newLevels));
    }
  };

  const handleBuyCredits = (gemCost: number, creditAmount: number) => {
    if (gems >= gemCost) {
      saveGems(gems - gemCost);
      saveCredits(credits + creditAmount);
      audioManager.play('coin');
    }
  };

  // Car Tuning Logic
  const handleUpgradeStat = (carId: string, stat: 'speed' | 'handling') => {
    const currentConfig = carConfigs[carId] || { id: carId, color: CAR_MODELS.find(c => c.id === carId)?.color || '#fff', stats: { speed: 1, handling: 1 } };
    const currentLevel = currentConfig.stats[stat];

    if (currentLevel >= 5) return;

    const cost = stat === 'speed' ? UPGRADE_COSTS.SPEED * currentLevel : UPGRADE_COSTS.HANDLING * currentLevel;

    if (credits >= cost) {
      const newCredits = credits - cost;
      saveCredits(newCredits);

      const newConfig = {
        ...currentConfig,
        stats: {
          ...currentConfig.stats,
          [stat]: currentLevel + 1
        }
      };

      saveCarConfigs({ ...carConfigs, [carId]: newConfig });
    }
  };

  const handleColorChange = (carId: string, newColor: string) => {
    const currentConfig = carConfigs[carId] || { id: carId, color: CAR_MODELS.find(c => c.id === carId)?.color || '#fff', stats: { speed: 1, handling: 1 } };

    const newConfig = {
      ...currentConfig,
      color: newColor
    };

    saveCarConfigs({ ...carConfigs, [carId]: newConfig });
  };

  // Helper to get config safely
  const getCurrentCarConfig = (index: number) => {
    const model = CAR_MODELS[index];
    return carConfigs[model.id] || {
      id: model.id,
      color: model.color,
      stats: { speed: 1, handling: 1 }
    };
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Background Gradient Mesh approximation for that retro feel behind canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#050510] to-black opacity-50 z-0 pointer-events-none"></div>

      <GameCanvas
        gameState={gameState}
        setGameState={handleGameOver}
        setScore={setScore}
        gameSpeedRef={gameSpeedRef}
        selectedCarIndex={selectedCarIndex}
        onCoinCollect={handleCoinCollect}
        onGemCollect={handleGemCollect}
        onPowerUpsUpdate={setActivePowerUps}
        setMultiplier={setMultiplier}
        setCurrentSpeed={setCurrentSpeed}
        powerUpLevels={powerUpLevels}
        activeCarConfig={getCurrentCarConfig(selectedCarIndex)}
        menuState={menuState}
        isRevivingRef={isRevivingRef}
        resetKey={resetKey}
      />

      <UIOverlay
        gameState={gameState}
        menuState={menuState}
        setMenuState={setMenuState}
        score={score}
        highScore={highScore}
        credits={credits}
        gems={gems}
        runCredits={runCredits}
        runGems={runGems}
        unlockedCars={unlockedCars}
        onStart={handleStart}
        onRestart={handleRestart}
        onRevive={handleRevive}
        reviveCost={REVIVE_COST}
        selectedCarIndex={selectedCarIndex}
        setSelectedCarIndex={setSelectedCarIndex}
        onBuyCar={handleBuyCar}
        activePowerUps={activePowerUps}
        multiplier={multiplier}
        currentSpeed={currentSpeed}
        powerUpLevels={powerUpLevels}
        onUpgradePowerUp={handleUpgradePowerUp}
        carConfigs={carConfigs}
        onUpgradeStat={handleUpgradeStat}
        onColorChange={handleColorChange}
        onPause={handlePause}
        onResume={handleResume}
        onQuit={handleQuit}
        language={language}
        setLanguage={handleSetLanguage}
        musicVolume={musicVolume}
        setMusicVolume={handleSetMusicVolume}
        sfxVolume={sfxVolume}
        setSfxVolume={handleSetSfxVolume}
        onBuyCredits={handleBuyCredits}
        missions={missions}
        onClaimMission={claimMissionReward}
      />
    </div>
  );
};

export default App;