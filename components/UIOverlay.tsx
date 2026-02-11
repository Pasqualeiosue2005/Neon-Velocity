
import React, { useState } from 'react';
import { GameState, PowerUpType, PowerUpLevels, CarConfig, Language, CarRarity, Mission } from '../types';
import { CAR_MODELS, SCALING_CONFIG, UPGRADE_COSTS, NEON_PALETTE, TRANSLATIONS, RARITY_COLORS } from '../constants';
import { Play, RotateCcw, Trophy, ChevronLeft, Lock, CircleDollarSign, ShoppingCart, Shield, Magnet, Zap, Wrench, Palette, Gauge, MoveHorizontal, Pause, Home, Settings, Volume2, Globe, HeartPulse, Music, Speaker, Diamond, Calendar, Check, X } from 'lucide-react';
import { audioManager } from '../utils/AudioManager';

interface UIOverlayProps {
    gameState: GameState;
    score: number;
    highScore: number;
    credits: number;
    gems: number; // New Prop
    runCredits: number;
    runGems: number; // New Prop
    unlockedCars: string[];
    onStart: () => void;
    onRestart: () => void;
    onRevive: () => void;
    reviveCost: number;
    selectedCarIndex: number;
    setSelectedCarIndex: (index: number) => void;
    onBuyCar: (carId: string, cost: number) => void;
    activePowerUps: Record<string, number>;
    multiplier: number;
    currentSpeed: number;
    powerUpLevels: PowerUpLevels;
    onUpgradePowerUp: (type: PowerUpType) => void;
    carConfigs: Record<string, CarConfig>;
    onUpgradeStat: (carId: string, stat: 'speed' | 'handling') => void;
    onColorChange: (carId: string, color: string) => void;
    onPause?: () => void;
    onResume?: () => void;
    onQuit?: () => void;
    // Settings
    language: Language;
    setLanguage: (lang: Language) => void;
    musicVolume: number;
    setMusicVolume: (vol: number) => void;
    sfxVolume: number;
    setSfxVolume: (vol: number) => void;
    // Menu Control
    menuState: 'HOME' | 'GARAGE' | 'UPGRADES' | 'SETTINGS' | 'SHOP';
    setMenuState: (state: 'HOME' | 'GARAGE' | 'UPGRADES' | 'SETTINGS' | 'SHOP') => void;
    onBuyCredits: (gemCost: number, creditAmount: number) => void;
    missions: Mission[];
    onClaimMission: (missionId: string) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
    gameState,
    score,
    highScore,
    credits,
    gems,
    runCredits,
    runGems,
    unlockedCars,
    onStart,
    onRestart,
    onRevive,
    reviveCost,
    selectedCarIndex,
    setSelectedCarIndex,
    onBuyCar,
    activePowerUps,
    multiplier,
    currentSpeed,
    powerUpLevels,
    onUpgradePowerUp,
    carConfigs,
    onUpgradeStat,
    onColorChange,
    onPause,
    onResume,
    onQuit,
    language,
    setLanguage,
    musicVolume,
    setMusicVolume,
    sfxVolume,
    setSfxVolume,
    menuState,
    setMenuState,
    onBuyCredits,
    missions,
    onClaimMission
}) => {
    const t = TRANSLATIONS[language];
    const [currentTrackName, setCurrentTrackName] = useState(audioManager.getCurrentTrackName());
    const [showMissions, setShowMissions] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Pause Menu Settings State

    const handleMenuChange = (state: 'HOME' | 'GARAGE' | 'UPGRADES' | 'SETTINGS' | 'SHOP') => {
        audioManager.play('click');
        setMenuState(state);
    };

    const handleStart = () => {
        audioManager.play('click');
        onStart();
    };

    const handleRestart = () => {
        audioManager.play('click');
        onRestart();
    };

    const handleReviveClick = () => {
        if (credits >= reviveCost) {
            audioManager.play('click');
            onRevive();
        }
    };

    const handlePause = () => {
        audioManager.play('click');
        if (onPause) onPause();
    };

    const handleResume = () => {
        audioManager.play('click');
        if (onResume) onResume();
    };

    const handleQuit = () => {
        audioManager.play('click');
        if (onQuit) onQuit();
    }

    const handleCarSelect = (index: number) => {
        audioManager.play('click');
        setSelectedCarIndex(index);
    };

    const handleBuy = (id: string, price: number) => {
        audioManager.play('unlock'); // Different sound for purchase
        onBuyCar(id, price);
    };

    const handleMusicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = parseFloat(e.target.value);
        setMusicVolume(newVol);
    };

    const handleSfxVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = parseFloat(e.target.value);
        setSfxVolume(newVol);
    };

    const handleChangeTrack = () => {
        audioManager.play('click');
        const name = audioManager.nextTrack();
        setCurrentTrackName(name);
    };

    const selectedCar = CAR_MODELS[selectedCarIndex];
    const isLocked = !unlockedCars.includes(selectedCar.id);

    // Logic for currency type
    const isGemCar = selectedCar.currency === 'GEMS';
    const canAfford = isGemCar ? gems >= selectedCar.price : credits >= selectedCar.price;

    const canAffordRevive = credits >= reviveCost;

    const currentConfig = carConfigs[selectedCar.id] || {
        id: selectedCar.id,
        color: selectedCar.color,
        stats: { speed: 1, handling: 1 }
    };

    const speedLevel = currentConfig.stats.speed;
    const handlingLevel = currentConfig.stats.handling;
    const speedCost = UPGRADE_COSTS.SPEED * speedLevel;
    const handlingCost = UPGRADE_COSTS.HANDLING * handlingLevel;

    const displaySpeed = Math.floor(currentSpeed * 30);
    const speedPercentage = Math.min(100, (currentSpeed / SCALING_CONFIG.maxSpeed) * 100);

    // Speedometer Calculation
    const rotation = -135 + (speedPercentage / 100) * 270;

    // Helper for translated rarity
    const getRarityLabel = (rarity: CarRarity) => {
        switch (rarity) {
            case 'COMMON': return t.R_COMMON;
            case 'RARE': return t.R_RARE;
            case 'EPIC': return t.R_EPIC;
            case 'LEGENDARY': return t.R_LEGENDARY;
            case 'MYTHIC': return t.R_MYTHIC;
            default: return rarity;
        }
    };

    if (gameState === GameState.START) {
        return (
            <div className="absolute inset-0 z-10 pointer-events-none">
                {/* Only show Title and Global Credits on Home Screen or non-Garage screens */}


                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {menuState === 'HOME' && (
                        <div className="absolute inset-0 flex flex-row pointer-events-none">

                            {/* LEFT SIDEBAR NAVBAR - Mobile: Full Screen Center / Desktop: Left Sidebar */}
                            <div className="pointer-events-auto w-full md:w-1/3 lg:w-1/4 h-full bg-black/30 md:bg-black/40 backdrop-blur-sm md:backdrop-blur-md border-r border-white/10 flex flex-col p-6 md:p-8 gap-6 md:gap-8 animate-in slide-in-from-left duration-500 overflow-y-auto shadow-2xl items-center md:items-stretch text-center md:text-left">

                                {/* HERO TITLE (Left Aligned) */}
                                <div className="flex flex-col gap-1 mb-4">
                                    <h1 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter skew-x-[-10deg] drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">
                                        NEON
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 block">
                                            VELOCITY
                                        </span>
                                    </h1>
                                    <div className="w-16 md:w-24 h-1 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]"></div>
                                </div>

                                {/* MOBILE CURRENCY (Inside Sidebar) */}
                                <div className="flex md:hidden gap-3 w-full mb-4">
                                    <div className="flex-1 flex items-center gap-2 bg-black/40 border border-yellow-500/30 rounded px-3 py-2">
                                        <CircleDollarSign size={16} className="text-yellow-400" />
                                        <span className="font-mono font-bold text-white text-sm">{credits}</span>
                                    </div>
                                    <div className="flex-1 flex items-center gap-2 bg-black/40 border border-rose-500/30 rounded px-3 py-2">
                                        <Diamond size={16} className="text-rose-400" />
                                        <span className="font-mono font-bold text-white text-sm">{gems}</span>
                                    </div>
                                </div>

                                {/* MENU BUTTONS */}
                                <div className="flex flex-col gap-4 mt-auto md:mt-0 justify-center h-full">
                                    {isLocked ? (
                                        <button
                                            onClick={() => handleMenuChange('GARAGE')}
                                            className="w-full py-4 px-6 bg-red-900/50 text-red-200 font-bold text-xl rounded-sm border-l-4 border-red-500 flex items-center gap-4 cursor-pointer hover:bg-red-900/80 transition-all"
                                        >
                                            <Lock size={24} />
                                            {t.LOCKED_GARAGE}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleStart}
                                            className="group w-full py-5 px-6 relative overflow-hidden bg-white text-black font-black text-2xl skew-x-[-10deg] hover:bg-cyan-400 hover:text-white hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] flex items-center justify-between"
                                        >
                                            <span className="skew-x-[10deg] flex items-center gap-3">
                                                {t.START_RACE} <Play className="fill-current" />
                                            </span>
                                            <div className="absolute right-0 top-0 h-full w-2 bg-black/20 transform skew-x-[20deg]"></div>
                                        </button>
                                    )}

                                    <div className="h-px w-full bg-white/20 my-2"></div>

                                    <button onClick={() => handleMenuChange('GARAGE')} className="group w-full py-4 px-6 bg-black/30 border border-white/10 hover:border-yellow-400 hover:bg-black/60 text-white hover:text-yellow-400 transition-all text-left flex items-center gap-4 skew-x-[-10deg]">
                                        <div className="skew-x-[10deg] flex items-center gap-4 w-full">
                                            <ShoppingCart size={20} />
                                            <span className="font-bold tracking-widest text-lg">{t.GARAGE}</span>
                                        </div>
                                    </button>

                                    <button onClick={() => handleMenuChange('UPGRADES')} className="group w-full py-4 px-6 bg-black/30 border border-white/10 hover:border-fuchsia-400 hover:bg-black/60 text-white hover:text-fuchsia-400 transition-all text-left flex items-center gap-4 skew-x-[-10deg]">
                                        <div className="skew-x-[10deg] flex items-center gap-4 w-full">
                                            <Wrench size={20} />
                                            <span className="font-bold tracking-widest text-lg">{t.TECH_LAB}</span>
                                        </div>
                                    </button>

                                    <button onClick={() => handleMenuChange('SHOP')} className="group w-full py-4 px-6 bg-black/30 border border-white/10 hover:border-rose-400 hover:bg-black/60 text-white hover:text-rose-400 transition-all text-left flex items-center gap-4 skew-x-[-10deg]">
                                        <div className="skew-x-[10deg] flex items-center gap-4 w-full">
                                            <Diamond size={20} />
                                            <span className="font-bold tracking-widest text-lg">GEM SHOP</span>
                                        </div>
                                    </button>

                                    <button onClick={() => setShowMissions(true)} className="group w-full py-4 px-6 bg-black/30 border border-white/10 hover:border-emerald-400 hover:bg-black/60 text-white hover:text-emerald-400 transition-all text-left flex items-center gap-4 skew-x-[-10deg]">
                                        <div className="skew-x-[10deg] flex items-center gap-4 w-full">
                                            <Calendar size={20} />
                                            <span className="font-bold tracking-widest text-lg">MISSIONS</span>
                                            {missions.some(m => m.completed && !m.claimed) && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>}
                                        </div>
                                    </button>

                                    <button onClick={() => handleMenuChange('SETTINGS')} className="group w-full py-4 px-6 bg-black/30 border border-white/10 hover:border-gray-400 hover:bg-black/60 text-white hover:text-gray-300 transition-all text-left flex items-center gap-4 skew-x-[-10deg]">
                                        <div className="skew-x-[10deg] flex items-center gap-4 w-full">
                                            <Settings size={20} />
                                            <span className="font-bold tracking-widest text-lg">{t.SETTINGS}</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT AREA (Empty for Car View) - Desktop Only */}
                            <div className="flex-1 pointer-events-none hidden md:block"></div>
                        </div>
                    )}

                    {/* MISSIONS MODAL - Outside Sidebar for Full Overlay */}
                    {showMissions && (
                        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
                            <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-lg p-6 flex flex-col gap-6 shadow-2xl relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowMissions(false); }}
                                    className="absolute top-4 right-4 text-white/50 hover:text-white p-2"
                                >
                                    <X size={24} />
                                </button>

                                <div className="text-center">
                                    <h2 className="text-3xl font-black italic text-emerald-400 tracking-tighter">DAILY MISSIONS</h2>
                                    <p className="text-white/60">Complete tasks to earn Gems!</p>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {missions.map(m => (
                                        <div key={m.id} className={`p-4 rounded-md border flex items-center justify-between gap-4 ${m.completed ? (m.claimed ? 'bg-emerald-900/20 border-emerald-900/50' : 'bg-emerald-500/10 border-emerald-500') : 'bg-slate-800 border-white/10'}`}>
                                            <div className="flex-1 text-left">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`font-bold ${m.completed ? 'text-emerald-400' : 'text-white'}`}>{m.description}</span>
                                                    {m.completed && <Check size={16} className="text-emerald-400" />}
                                                </div>
                                                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}></div>
                                                </div>
                                                <div className="text-xs text-right text-white/50 mt-1">{Math.floor(m.progress)} / {m.target}</div>
                                            </div>

                                            {m.claimed ? (
                                                <div className="flex items-center gap-2 text-emerald-500 font-bold opacity-50">
                                                    <span>CLAIMED</span>
                                                </div>
                                            ) : (
                                                m.completed ? (
                                                    <button
                                                        onClick={() => { onClaimMission(m.id); }}
                                                        className="px-4 py-2 bg-emerald-500 text-black font-bold rounded hover:bg-emerald-400 transition-colors flex items-center gap-2"
                                                    >
                                                        CLAIM <Diamond size={16} className="fill-black" /> {m.reward}
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-emerald-400 font-bold">
                                                        <Diamond size={16} /> {m.reward}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FIXED CURRENCY HEADER (Visible in all Menu States) */}
                    {
                        Object.values(GameState).includes(gameState) && menuState && (
                            <div className="hidden md:flex absolute top-4 right-4 md:top-8 md:right-8 flex-col items-end md:flex-row md:items-center gap-2 md:gap-4 pointer-events-auto z-50">
                                <div className="flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-yellow-500/30 shadow-lg">
                                    <CircleDollarSign size={16} className="text-yellow-400 md:w-5 md:h-5" />
                                    <span className="text-base md:text-2xl font-bold font-mono text-white">{credits}</span>
                                </div>
                                <div className="flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-rose-500/30 shadow-lg">
                                    <Diamond size={16} className="text-rose-400 md:w-5 md:h-5" />
                                    <span className="text-base md:text-2xl font-bold font-mono text-white">{gems}</span>
                                </div>
                            </div>
                        )
                    }
                    {/* Global Currency Header continues... */}

                    {
                        menuState === 'GARAGE' && (
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-4 md:p-8 overflow-hidden">
                                {/* TOP ROW */}
                                {/* TOP ROW */}
                                <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center pointer-events-auto z-20 gap-4">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => handleMenuChange('HOME')} className="text-white hover:text-cyan-400 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-gray-600 hover:border-cyan-400 transition-all active:scale-95 backdrop-blur-md shadow-lg">
                                            <ChevronLeft size={20} /> <span className="font-bold">{t.BACK}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* CENTER CAR TITLE (Floating) */}
                                <div className="absolute top-20 md:top-24 left-0 w-full flex flex-col items-center justify-center pointer-events-none z-10 opacity-80">
                                    <h2
                                        className="text-4xl md:text-6xl font-black italic text-transparent bg-clip-text uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-y-110 text-center px-4"
                                        style={{
                                            backgroundImage: `linear-gradient(180deg, #fff, ${currentConfig.color})`,
                                            WebkitTextStroke: '1px black'
                                        }}
                                    >
                                        {selectedCar.name}
                                    </h2>
                                    <div className="flex gap-2 mt-1">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-black border border-white" style={{ backgroundColor: RARITY_COLORS[selectedCar.rarity] }}>
                                            {getRarityLabel(selectedCar.rarity)}
                                        </span>
                                        <span className="px-2 py-0.5 bg-gray-900 border border-gray-600 rounded text-[10px] font-bold text-gray-300 uppercase">
                                            {selectedCar.type}
                                        </span>
                                    </div>
                                </div>

                                {/* MIDDLE AREA - Clear for 3D View */}
                                <div className="flex-1"></div>

                                {/* BOTTOM CONTROLS */}
                                <div className="w-full flex flex-col gap-4 pointer-events-auto z-20 pb-4">

                                    {/* Action Buttons Row */}
                                    <div className="flex justify-center items-center gap-4 px-2">
                                        {isLocked ? (
                                            <div className="flex flex-col items-center gap-2 bg-black/80 p-4 rounded-lg border border-gray-700 backdrop-blur-md max-w-sm w-full">
                                                <p className="text-gray-300 text-xs text-center line-clamp-2">{selectedCar.description}</p>
                                                <button
                                                    onClick={() => handleBuy(selectedCar.id, selectedCar.price)}
                                                    disabled={!canAfford}
                                                    className={`w-full py-3 font-bold text-lg rounded shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2
                                                    ${canAfford ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
                                                `}
                                                >
                                                    {canAfford ? <ShoppingCart size={20} /> : <Lock size={20} />}
                                                    {t.PURCHASE} - {selectedCar.price}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 w-full max-w-md">
                                                <button onClick={() => onUpgradeStat(selectedCar.id, 'speed')} disabled={credits < speedCost || speedLevel >= 5} className="flex-1 bg-black/80 border border-cyan-500/50 p-2 rounded flex flex-col items-center active:bg-cyan-900/50">
                                                    <span className="text-[10px] text-cyan-400 font-bold">SPD LVL {speedLevel}</span>
                                                    <span className="text-xs text-white pb-1">{speedCost} CR</span>
                                                    <div className="flex gap-0.5 h-1 w-full bg-gray-800"><div className="h-full bg-cyan-400" style={{ width: `${speedLevel * 20}%` }}></div></div>
                                                </button>
                                                <button onClick={() => onUpgradeStat(selectedCar.id, 'handling')} disabled={credits < handlingCost || handlingLevel >= 5} className="flex-1 bg-black/80 border border-fuchsia-500/50 p-2 rounded flex flex-col items-center active:bg-fuchsia-900/50">
                                                    <span className="text-[10px] text-fuchsia-400 font-bold">HND LVL {handlingLevel}</span>
                                                    <span className="text-xs text-white pb-1">{handlingCost} CR</span>
                                                    <div className="flex gap-0.5 h-1 w-full bg-gray-800"><div className="h-full bg-fuchsia-400" style={{ width: `${handlingLevel * 20}%` }}></div></div>
                                                </button>

                                                {/* Color Picker Mini */}
                                                <div className="w-12 relative overflow-hidden rounded border border-white/20">
                                                    <input type="color" value={currentConfig.color} onChange={(e) => onColorChange(selectedCar.id, e.target.value)} className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer" />
                                                    <Palette size={16} className="absolute center inset-0 m-auto pointer-events-none text-white mix-blend-difference" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Select Button (if owned) */}
                                    {!isLocked && (
                                        <button onClick={() => handleMenuChange('HOME')} className="w-full max-w-sm mx-auto py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-xl rounded shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2 active:scale-95 transition-transform">
                                            <Play size={24} fill="white" /> {t.SELECT_RACE}
                                        </button>
                                    )}

                                    {/* Carousel */}
                                    <div className="flex overflow-x-auto gap-3 px-4 pb-2 snap-x scrollbar-hide mask-fade-sides">
                                        {CAR_MODELS.map((car, index) => {
                                            const isSelected = index === selectedCarIndex;
                                            const rarityColor = RARITY_COLORS[car.rarity];
                                            return (
                                                <button
                                                    key={car.id}
                                                    onClick={() => handleCarSelect(index)}
                                                    className={`
                                                    flex-shrink-0 w-20 h-14 rounded-md border-2 relative overflow-hidden transition-all snap-center
                                                    ${isSelected ? 'scale-110 z-10 shadow-lg' : 'opacity-60'}
                                                `}
                                                    style={{
                                                        backgroundColor: index === selectedCarIndex ? carConfigs[car.id]?.color || car.color : '#111',
                                                        borderColor: rarityColor,
                                                        boxShadow: isSelected ? `0 0 10px ${rarityColor}` : 'none'
                                                    }}
                                                >
                                                    {!unlockedCars.includes(car.id) && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Lock size={14} className="text-gray-400" /></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* ... Rest of the menu code (Settings, Upgrades) ... */}
                    {
                        menuState === 'UPGRADES' && (
                            <div className="bg-black/80 backdrop-blur-md p-6 md:p-8 rounded-lg border border-gray-800 flex flex-col gap-6 pointer-events-auto max-w-2xl w-full mx-4">
                                <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2"><Wrench className="text-fuchsia-500" /> {t.TECH_LAB}</h2>
                                    <button onClick={() => handleMenuChange('HOME')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm md:text-base"><ChevronLeft size={18} /> {t.BACK}</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Shield Upgrade */}
                                    <div className="bg-gray-900/50 p-4 rounded border border-gray-700 flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2 text-cyan-400">
                                                <Shield size={20} className="md:w-6 md:h-6" />
                                                <span className="font-bold text-sm md:text-base">{t.SHIELD_DUR}</span>
                                            </div>
                                            <span className="text-xs font-bold bg-cyan-900 text-cyan-200 px-2 py-1 rounded">LVL {powerUpLevels.SHIELD}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{t.SHIELD_DESC}</p>
                                        <div className="mt-auto pt-4">
                                            {powerUpLevels.SHIELD < 5 ? (
                                                <button
                                                    onClick={() => { audioManager.play('click'); onUpgradePowerUp(PowerUpType.SHIELD); }}
                                                    disabled={gems < powerUpLevels.SHIELD * 5}
                                                    className={`w-full py-2 font-bold rounded text-sm flex items-center justify-center gap-2 ${gems >= powerUpLevels.SHIELD * 5 ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'bg-gray-800 text-gray-600'}`}
                                                >
                                                    {t.UPGRADE} ({powerUpLevels.SHIELD * 5} <Diamond size={12} />)
                                                </button>
                                            ) : (
                                                <div className="w-full py-2 text-center text-cyan-500 font-bold text-sm border border-cyan-900 bg-cyan-900/20">{t.MAXED}</div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Magnet Upgrade */}
                                    <div className="bg-gray-900/50 p-4 rounded border border-gray-700 flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2 text-fuchsia-400">
                                                <Magnet size={20} className="md:w-6 md:h-6" />
                                                <span className="font-bold text-sm md:text-base">{t.MAGNET_DUR}</span>
                                            </div>
                                            <span className="text-xs font-bold bg-fuchsia-900 text-fuchsia-200 px-2 py-1 rounded">LVL {powerUpLevels.MAGNET}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{t.MAGNET_DESC}</p>
                                        <div className="mt-auto pt-4">
                                            {powerUpLevels.MAGNET < 5 ? (
                                                <button
                                                    onClick={() => { audioManager.play('click'); onUpgradePowerUp(PowerUpType.MAGNET); }}
                                                    disabled={gems < powerUpLevels.MAGNET * 5}
                                                    className={`w-full py-2 font-bold rounded text-sm flex items-center justify-center gap-2 ${gems >= powerUpLevels.MAGNET * 5 ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-500' : 'bg-gray-800 text-gray-600'}`}
                                                >
                                                    {t.UPGRADE} ({powerUpLevels.MAGNET * 5} <Diamond size={12} />)
                                                </button>
                                            ) : (
                                                <div className="w-full py-2 text-center text-fuchsia-500 font-bold text-sm border border-fuchsia-900 bg-fuchsia-900/20">{t.MAXED}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {
                        menuState === 'SHOP' && (
                            <div className="bg-black/90 backdrop-blur-md p-6 md:p-8 rounded-lg border border-rose-500/30 flex flex-col gap-6 pointer-events-auto max-w-lg w-full mx-4 shadow-[0_0_50px_rgba(244,63,94,0.2)]">
                                <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                                    <h2 className="text-xl md:text-2xl font-bold text-rose-400 flex items-center gap-2"><Diamond className="animate-pulse" /> GEM SHOP</h2>
                                    <button onClick={() => handleMenuChange('HOME')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm md:text-base"><ChevronLeft size={18} /> {t.BACK}</button>
                                </div>

                                <div className="p-4 bg-gray-900/50 rounded text-center mb-2">
                                    <p className="text-gray-400 text-sm mb-1">{t.TOTAL_BALANCE}</p>
                                    <div className="flex justify-center gap-6">
                                        <div className="flex items-center gap-2 text-rose-400">
                                            <Diamond size={20} /> <span className="text-2xl font-bold">{gems}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-yellow-400">
                                            <CircleDollarSign size={20} /> <span className="text-2xl font-bold">{credits}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button onClick={() => onBuyCredits(10, 1000)} disabled={gems < 10} className="group p-4 bg-gray-800 border-l-4 border-yellow-500 hover:bg-gray-700 flex items-center justify-between transition-all disabled:opacity-50">
                                        <div className="flex flex-col text-left">
                                            <span className="text-white font-bold text-lg group-hover:text-yellow-400">1,000 CREDITS</span>
                                            <span className="text-gray-400 text-xs">EXCHANGE 10 GEMS</span>
                                        </div>
                                        <div className="flex items-center bg-black/50 px-3 py-1 rounded text-rose-400 font-bold gap-1">
                                            10 <Diamond size={14} />
                                        </div>
                                    </button>

                                    <button onClick={() => onBuyCredits(50, 5500)} disabled={gems < 50} className="group p-4 bg-gray-800 border-l-4 border-yellow-500 hover:bg-gray-700 flex items-center justify-between transition-all disabled:opacity-50">
                                        <div className="flex flex-col text-left">
                                            <span className="text-white font-bold text-lg group-hover:text-yellow-400">5,500 CREDITS</span>
                                            <span className="text-gray-400 text-xs text-green-400">EXCHANGE 50 GEMS (+10% BONUS)</span>
                                        </div>
                                        <div className="flex items-center bg-black/50 px-3 py-1 rounded text-rose-400 font-bold gap-1">
                                            50 <Diamond size={14} />
                                        </div>
                                    </button>

                                    <button onClick={() => onBuyCredits(100, 12000)} disabled={gems < 100} className="group p-4 bg-gray-800 border-l-4 border-yellow-500 hover:bg-gray-700 flex items-center justify-between transition-all disabled:opacity-50">
                                        <div className="flex flex-col text-left">
                                            <span className="text-white font-bold text-lg group-hover:text-yellow-400">12,000 CREDITS</span>
                                            <span className="text-gray-400 text-xs text-green-400">EXCHANGE 100 GEMS (+20% BONUS)</span>
                                        </div>
                                        <div className="flex items-center bg-black/50 px-3 py-1 rounded text-rose-400 font-bold gap-1">
                                            100 <Diamond size={14} />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    {
                        menuState === 'SETTINGS' && (
                            <div className="bg-black/80 backdrop-blur-md p-6 md:p-8 rounded-lg border border-gray-800 flex flex-col gap-8 pointer-events-auto max-w-lg w-full mx-4">
                                <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2"><Settings className="text-gray-400" /> {t.SETTINGS}</h2>
                                    <button onClick={() => handleMenuChange('HOME')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm md:text-base"><ChevronLeft size={18} /> {t.BACK}</button>
                                </div>

                                <div className="flex flex-col gap-6">
                                    {/* Music Volume Control */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between text-white font-bold">
                                            <div className="flex items-center gap-2 text-cyan-400">
                                                <Music size={20} />
                                                <span>MUSIC VOL</span>
                                            </div>
                                            <span>{Math.round(musicVolume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={musicVolume}
                                            onChange={handleMusicVolumeChange}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        />
                                    </div>

                                    {/* SFX Volume Control */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between text-white font-bold">
                                            <div className="flex items-center gap-2 text-yellow-400">
                                                <Speaker size={20} />
                                                <span>SFX VOL</span>
                                            </div>
                                            <span>{Math.round(sfxVolume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={sfxVolume}
                                            onChange={handleSfxVolumeChange}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                        />
                                    </div>

                                    {/* Track Selection */}
                                    <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded border border-gray-700">
                                        <span className="text-gray-300 font-bold flex items-center gap-2"><Volume2 size={16} /> TRACK</span>
                                        <button
                                            onClick={handleChangeTrack}
                                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-cyan-400 font-bold text-sm tracking-widest uppercase min-w-[120px]"
                                        >
                                            {currentTrackName}
                                        </button>
                                    </div>

                                    {/* Language Selection */}
                                    <div className="flex flex-col gap-3 border-t border-gray-700 pt-4">
                                        <div className="flex items-center gap-2 text-fuchsia-400 font-bold">
                                            <Globe size={20} />
                                            <span>{t.LANGUAGE}</span>
                                        </div>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => { audioManager.play('click'); setLanguage('EN'); }}
                                                className={`flex-1 py-3 border font-bold rounded transition-all text-sm md:text-base ${language === 'EN' ? 'bg-fuchsia-900/50 border-fuchsia-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'}`}
                                            >
                                                ENGLISH
                                            </button>
                                            <button
                                                onClick={() => { audioManager.play('click'); setLanguage('IT'); }}
                                                className={`flex-1 py-3 border font-bold rounded transition-all text-sm md:text-base ${language === 'IT' ? 'bg-fuchsia-900/50 border-fuchsia-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'}`}
                                            >
                                                ITALIANO
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
            </div >
        );
    }

    // ... (Remainder of the component remains the same for Playing/Paused/GameOver)

    if (gameState === GameState.PLAYING) {
        return (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none select-none">

                <div className="absolute top-0 w-full p-4 md:p-6 flex justify-between items-start">
                    <div className="flex flex-col">
                        <span className="text-cyan-400 text-xs md:text-sm font-bold tracking-widest uppercase mb-1 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">{t.SCORE}</span>
                        <span className="text-3xl md:text-4xl text-white font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{score}</span>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">
                            <CircleDollarSign size={20} className="md:w-6 md:h-6" />
                            <span className="text-2xl md:text-3xl font-bold">{runCredits}</span>
                        </div>
                        {/* GEM COUNTER IN GAME */}
                        <div className="flex items-center gap-2 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] mt-1">
                            <Diamond size={16} className="md:w-5 md:h-5" />
                            <span className="text-xl md:text-2xl font-bold">{runGems}</span>
                        </div>

                        <div className="mt-1 md:mt-2 text-fuchsia-400 flex items-center gap-1 animate-pulse drop-shadow-[0_0_10px_rgba(232,121,249,0.8)]">
                            <Zap size={14} className="md:w-4 md:h-4" fill="currentColor" />
                            <span className="text-xl md:text-2xl font-black italic tracking-tighter">x{multiplier}</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end pointer-events-auto">
                        <button onClick={handlePause} className="mb-2 p-2 bg-black/40 text-cyan-400 border border-cyan-500/50 rounded hover:bg-cyan-900/50 hover:text-white transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                            <Pause size={20} fill="currentColor" />
                        </button>
                        <div className="flex flex-col items-end opacity-80 pointer-events-none">
                            <span className="text-pink-500 text-[10px] md:text-xs font-bold tracking-widest uppercase mb-1">{t.HIGH_SCORE}</span>
                            <span className="text-xl md:text-2xl text-white font-bold">{Math.max(score, highScore)}</span>
                        </div>
                    </div>
                </div>

                {/* FUTURISTIC SPEEDOMETER */}
                <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 flex items-center justify-center w-28 h-28 md:w-40 md:h-40">
                    {/* Speedometer Circle BG */}
                    <div className="absolute inset-0 rounded-full border-4 border-gray-800/50 backdrop-blur-sm"></div>

                    {/* Ticks */}
                    <svg className="absolute w-full h-full -rotate-90">
                        <circle
                            cx="50%" cy="50%" r="45%"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeDasharray="220" /* approx circumference */
                            strokeDashoffset={220 - (220 * speedPercentage) / 100}
                            className="text-cyan-500 transition-all duration-100 ease-out drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                            strokeLinecap="round"
                            style={{ strokeDasharray: `283`, strokeDashoffset: `${283 - (283 * (speedPercentage * 0.75)) / 100}` }} // 75% circle
                        />
                    </svg>

                    <div className="flex flex-col items-center z-10">
                        <span className="text-3xl md:text-5xl font-black italic text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                            {displaySpeed}
                        </span>
                        <span className="text-[8px] md:text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mt-1">KM/H</span>
                    </div>
                </div>

                {/* ACTIVE POWERUPS STATUS BARS - MOVED TO TOP LEFT */}
                <div className="absolute top-28 left-4 md:top-32 md:left-6 flex flex-col gap-2 md:gap-4">
                    {Object.entries(activePowerUps).map(([type, time]) => (
                        <div key={type} className="flex items-center gap-2 md:gap-3 animate-in slide-in-from-left duration-300">
                            <div className={`
                         w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center shadow-[0_0_15px_currentColor]
                         ${type === PowerUpType.SHIELD ? 'bg-cyan-900/50 border-cyan-400 text-cyan-400' : 'bg-fuchsia-900/50 border-fuchsia-400 text-fuchsia-400'}
                     `}>
                                {type === PowerUpType.SHIELD ? <Shield size={20} className="md:w-6 md:h-6" /> : <Magnet size={20} className="md:w-6 md:h-6" />}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${type === PowerUpType.SHIELD ? 'text-cyan-400' : 'text-fuchsia-400'}`}>
                                    {type}
                                </span>
                                <span className="text-lg md:text-xl font-black text-white drop-shadow-md">
                                    {Math.ceil((time as number) / 60)}s
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        );
    }

    // PAUSE MENU
    if (gameState === GameState.PAUSED) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 px-4">
                <div className="relative p-6 md:p-10 max-w-sm w-full text-center border-2 border-cyan-500/50 bg-black/90 shadow-[0_0_50px_rgba(6,182,212,0.3)] rounded-lg">

                    {/* Corner Accents */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-400"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-400"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-400"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-400"></div>

                    <h2 className="text-2xl md:text-4xl font-black text-cyan-400 mb-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] tracking-tighter">{t.SYSTEM_PAUSED}</h2>
                    <div className="w-16 h-1 bg-cyan-500 mx-auto mb-6 md:mb-8 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>

                    {!isSettingsOpen ? (
                        <div className="flex flex-col gap-3 md:gap-4">
                            <button
                                onClick={handleResume}
                                className="group w-full py-3 md:py-4 border border-cyan-500 text-white font-bold text-base md:text-lg rounded-sm hover:bg-cyan-500 hover:text-black transition-all flex items-center justify-center gap-3 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                            >
                                <Play size={20} fill="currentColor" className="group-hover:fill-black" />
                                {t.RESUME}
                            </button>

                            <button
                                onClick={handleRestart}
                                className="w-full py-3 md:py-4 border border-gray-600 text-gray-300 font-bold text-base md:text-lg rounded-sm hover:border-white hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                            >
                                <RotateCcw size={20} />
                                {t.RESTART}
                            </button>

                            {/* Added GARAGE Button (Quits to Garage) - Swapped Order */}
                            <button
                                onClick={() => { audioManager.play('click'); handleQuit(); setMenuState('GARAGE'); }}
                                className="w-full py-3 md:py-4 bg-gray-800/50 border border-yellow-600/50 text-yellow-500 font-bold text-base md:text-lg rounded-sm hover:bg-yellow-600 hover:text-black transition-all flex items-center justify-center gap-3 shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                            >
                                <Wrench size={20} />
                                {t.GARAGE}
                            </button>

                            {/* Added SETTINGS Button */}
                            <button
                                onClick={() => { audioManager.play('click'); setIsSettingsOpen(true); }}
                                className="w-full py-3 md:py-4 bg-gray-800/50 border border-gray-600 text-gray-300 font-bold text-base md:text-lg rounded-sm hover:border-cyan-400 hover:text-cyan-400 hover:bg-cyan-900/10 transition-all flex items-center justify-center gap-3"
                            >
                                <Settings size={20} />
                                {t.SETTINGS}
                            </button>

                            <button
                                onClick={handleQuit}
                                className="w-full py-3 md:py-4 border border-gray-700 text-gray-500 font-bold text-base md:text-lg rounded-sm hover:border-pink-500 hover:text-pink-500 hover:bg-pink-900/20 transition-all flex items-center justify-center gap-3"
                            >
                                <Home size={20} />
                                {t.QUIT_MENU}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 animate-in slide-in-from-right duration-300">
                            {/* PAUSE SETTINGS UI */}
                            <div className="space-y-4">
                                {/* Volume Controls */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-gray-300 text-sm font-bold">
                                        <div className="flex items-center gap-2"><Music size={16} /> MUSIC</div>
                                        <span>{Math.round(musicVolume * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.1" value={musicVolume} onChange={(e) => handleChangeMusicVolume(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-gray-300 text-sm font-bold">
                                        <div className="flex items-center gap-2"><Speaker size={16} /> SFX</div>
                                        <span>{Math.round(sfxVolume * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.1" value={sfxVolume} onChange={(e) => handleChangeSfxVolume(parseFloat(e.target.value))} className="w-full accent-fuchsia-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                {/* Language */}
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => { audioManager.play('click'); setLanguage('EN'); }} className={`flex-1 py-2 border font-bold rounded text-xs ${language === 'EN' ? 'bg-fuchsia-900/50 border-fuchsia-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>ENGLISH</button>
                                    <button onClick={() => { audioManager.play('click'); setLanguage('IT'); }} className={`flex-1 py-2 border font-bold rounded text-xs ${language === 'IT' ? 'bg-fuchsia-900/50 border-fuchsia-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>ITALIANO</button>
                                </div>
                            </div>
                            <button
                                onClick={() => { audioManager.play('click'); setIsSettingsOpen(false); }}
                                className="mt-2 w-full py-3 border border-gray-600 text-white font-bold rounded hover:bg-gray-800 flex items-center justify-center gap-2"
                            >
                                <ChevronLeft size={20} /> {t.BACK}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        );
    }

    // GAME OVER SCREEN
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 px-4">
            <div className="relative p-6 md:p-10 max-w-lg w-full text-center border-2 border-cyan-500/50 bg-black/80 shadow-[0_0_50px_rgba(6,182,212,0.3)] rounded-lg transform transition-all">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-400"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-400"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-pink-500"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-pink-500"></div>

                <h2 className="text-4xl md:text-5xl font-black text-pink-600 mb-2 drop-shadow-[0_0_15px_rgba(219,39,119,0.8)]">{t.CRASHED}</h2>
                <p className="text-pink-200/50 mb-6 md:mb-8 text-base md:text-lg uppercase tracking-widest">{t.SYSTEM_FAILURE}</p>

                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                    <div className="flex flex-col bg-gray-900/50 p-3 md:p-4 rounded border border-gray-800">
                        <span className="text-xs text-gray-400 uppercase tracking-wider">{t.DISTANCE}</span>
                        <span className="text-2xl md:text-3xl font-bold text-white">{score}</span>
                    </div>

                    <div className="flex flex-col bg-gray-900/50 p-3 md:p-4 rounded border border-gray-800">
                        <span className="text-xs text-gray-400 uppercase tracking-wider text-yellow-500">{t.EARNED}</span>
                        <div className="flex justify-center gap-4">
                            <div className="flex items-center justify-center gap-1 text-yellow-400">
                                <CircleDollarSign size={18} />
                                <span className="text-xl md:text-2xl font-bold">{runCredits}</span>
                            </div>
                            {runGems > 0 && (
                                <div className="flex items-center justify-center gap-1 text-rose-400">
                                    <Diamond size={16} />
                                    <span className="text-xl md:text-2xl font-bold">{runGems}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="col-span-2 flex flex-col bg-gray-900/50 p-3 md:p-4 rounded border border-gray-800 relative overflow-hidden">
                        {score > highScore && (
                            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5">{t.NEW_RECORD}</div>
                        )}
                        <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1"><Trophy size={12} /> {t.BEST}</span>
                        <span className="text-2xl md:text-3xl font-bold text-cyan-400">{Math.max(score, highScore)}</span>
                    </div>

                    <div className="col-span-2 flex items-center justify-between bg-black/40 p-3 rounded border border-yellow-900/30">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">{t.TOTAL_BALANCE}</span>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1 text-yellow-600">
                                <CircleDollarSign size={14} />
                                <span className="text-base md:text-lg font-bold">{credits}</span>
                            </div>
                            <div className="flex items-center gap-1 text-rose-600">
                                <Diamond size={14} />
                                <span className="text-base md:text-lg font-bold">{gems}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {/* REVIVE BUTTON */}
                    <button
                        onClick={handleReviveClick}
                        disabled={!canAffordRevive}
                        className={`w-full py-4 border-2 font-black text-xl md:text-2xl rounded-sm transition-all flex items-center justify-center gap-3 relative overflow-hidden
                    ${canAffordRevive
                                ? 'bg-fuchsia-600 border-fuchsia-400 text-white hover:bg-fuchsia-500 shadow-[0_0_20px_rgba(232,121,249,0.5)] hover:shadow-[0_0_40px_rgba(232,121,249,0.7)] animate-pulse'
                                : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed opacity-70'}
                `}
                    >
                        <div className="flex items-center gap-2 relative z-10">
                            <HeartPulse size={28} className={canAffordRevive ? "animate-bounce" : ""} />
                            REVIVE
                            <span className="text-sm font-normal opacity-80 bg-black/30 px-2 py-0.5 rounded flex items-center gap-1">
                                <CircleDollarSign size={12} /> {reviveCost}
                            </span>
                        </div>
                    </button>
                    {!canAffordRevive && (
                        <div className="text-center mt-2 animate-pulse">
                            <span className="text-red-500 font-bold tracking-widest uppercase text-sm drop-shadow-[0_0_5px_rgba(239,68,68,0.8)] border border-red-500/50 px-2 py-1 rounded bg-black/50">
                                {t.INSUFFICIENT_FUNDS}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3 md:gap-4 mt-2">
                        <button
                            onClick={handleQuit}
                            className="flex-1 py-3 border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white font-bold text-sm md:text-base rounded-sm transition-all flex items-center justify-center gap-2"
                        >
                            <Home size={18} />
                            {t.MENU}
                        </button>
                        <button
                            onClick={handleRestart}
                            className="flex-[2] py-3 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black font-bold text-sm md:text-base rounded-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]"
                        >
                            <RotateCcw size={18} />
                            {t.REBOOT}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UIOverlay;