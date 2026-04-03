import React, { useState, useEffect, useCallback } from 'react';
import {
    ACADEMY_STAGES, INITIAL_USER_STATE, generateExercises,
    LEVEL_META, ACHIEVEMENTS, LESSONS_DB,
} from '../utils/academyData';
import { academyAudio } from '../utils/academyAudio';
import ExercisePlayer from '../components/ExercisePlayer';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import * as LucideIcons from 'lucide-react';

// ─── Icons ─────────────────────────────────────────────────────────────────────
const getIconComponent = (name) => {
    if (!name) return LucideIcons.HelpCircle;
    // Map legacy bottom nav IDs
    if (name === 'learn') name = 'book-open';
    if (name === 'practice') name = 'dumbbell';
    if (name === 'progress') name = 'trending-up';
    if (name === 'profile') name = 'user';
    
    // kebab-case to PascalCase (music-2 -> Music2)
    const pascalName = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    return LucideIcons[pascalName] || LucideIcons.HelpCircle;
};

const Icon = ({ name, size = 20, color = 'currentColor', style = {} }) => {
     
    const IconComponent = getIconComponent(name);
    return React.createElement(IconComponent, { size, color, style });
};

// ─── XP Level thresholds ──────────────────────────────────────────────────────
const XP_LEVELS = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7200, 10000];
const getUserLevel = (xp) => {
    let lv = 1;
    for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) lv = i + 1;
    return Math.min(lv, XP_LEVELS.length);
};
const getXPToNext = (xp) => {
    const lv = getUserLevel(xp);
    return lv < XP_LEVELS.length ? XP_LEVELS[lv] - xp : 0;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const accuracy = u => u.totalAnswered > 0 ? Math.round((u.totalCorrect / u.totalAnswered) * 100) : 0;

const TypewriterText = ({ text, speed = 40 }) => {
    const [displayedText, setDisplayedText] = useState('');
    useEffect(() => {
        setDisplayedText('');
        let i = 0;
        const timer = setInterval(() => {
            setDisplayedText(text.slice(0, i + 1));
            i++;
            if (i >= text.length) clearInterval(timer);
        }, speed);
        return () => clearInterval(timer);
    }, [text, speed]);
    return <span>{displayedText}</span>;
};

const MASCOT_URL = '/mascot_sheet.png';

const Mascot = ({ pose = 'happy', size = 100, speech = null, speechStyle = {} }) => {
    const POSES = {
        'happy':      '/mascota/alegre.png',
        'celebrate':  '/mascota/feliz.png',
        'think':      '/mascota/intelectual.png',
        'confused':   '/mascota/confundido.png',
        'surprised':  '/mascota/panico.png',
        'sad':        '/mascota/triste.png',
        'sleepy':     '/mascota/dormido.png',
        'angry':      '/mascota/enojado.png',
        'teaching':   '/mascota/intelectual.png',
        'cheer':      '/mascota/feliz.png',
    };
    const src = POSES[pose] || POSES.happy;
    
    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: speech ? 50 : 0 }}>
            {speech && (
                <div style={{
                    position: 'absolute', bottom: '115%', left: '50%', transform: 'translateX(-50%) translateY(-10px)',
                    background: '#fff', padding: '10px 18px', borderRadius: '18px',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.1)', border: '2px solid #f1f5f9',
                    fontSize: 15, fontWeight: 800, color: '#1e293b', 
                    whiteSpace: 'normal', textAlign: 'center', maxWidth: 260, width: 'max-content',
                    minWidth: 100,
                    zIndex: 10, ...speechStyle
                }}>
                    <TypewriterText text={speech} />
                    {/* Tail of speech bubble */}
                    <div style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '10px solid #fff'
                    }} />
                </div>
            )}
            <img 
                src={src} 
                alt="Mascot"
                style={{
                    width: size, height: 'auto',
                    transform: 'translateZ(0)',
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
            />
        </div>
    );
};

// ─── Stage badge ─────────────────────────────────────────────────────────────
const StageBadge = ({ stage, isActive }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px',
        borderRadius: 12,
        background: isActive ? stage.color + '20' : 'transparent',
        border: isActive ? `2px solid ${stage.color}` : '2px solid transparent',
        marginBottom: 8,
    }}>
        <span style={{ fontSize: 22 }}>{stage.icon}</span>
        <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{stage.title}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Níves {stage.levelsRange[0]}-{stage.levelsRange[1]}</div>
        </div>
    </div>
);

// ─── XP Toast notification ────────────────────────────────────────────────────
const XPToast = ({ amount, onDone }) => {
    // Total lifetime: 800ms  (250ms in + 300ms visible + 250ms out)
    const [fading, setFading] = React.useState(false);
    useEffect(() => {
        const fadeTimer = setTimeout(() => setFading(true), 550);
        const doneTimer = setTimeout(onDone, 800);
        return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div style={{
            position: 'fixed', top: 72, right: 16, zIndex: 9999,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', padding: '7px 14px', borderRadius: 100,
            fontWeight: 800, fontSize: 14,
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            pointerEvents: 'none',
            opacity: fading ? 0 : 1,
            transform: fading ? 'translateY(-6px) scale(0.9)' : 'translateY(0) scale(1)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            animation: 'toastIn 0.2s ease',
        }}>
            +{amount} XP ✨
            <style>{`@keyframes toastIn { from{opacity:0;transform:translateY(-10px) scale(0.85)} to{opacity:1;transform:translateY(0) scale(1)} }`}</style>
        </div>
    );
};

// ─── Loading Screen (declared outside Academy to prevent state reset on re-render) ─────
const LoadingScreen = ({ loadingMsg }) => (
    <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        zIndex: 9999, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: '#fff'
    }}>
        <div style={{ marginBottom: 40 }}>
            <Mascot
                pose={loadingMsg.pose}
                size={160}
                speech={loadingMsg.text}
                speechStyle={{ fontSize: 16, padding: '12px 20px', color: '#1e293b' }}
            />
        </div>
        <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 20 }}></div>
        <p style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.8 }}>
            Preparando Zion Academy
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// ─── Main Academy Component ───────────────────────────────────────────────────
const Academy = () => {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('zion_academy_user');
            const base = saved ? JSON.parse(saved) : { ...INITIAL_USER_STATE };
            // Update streak on load (runs once on mount, no effect needed)
            const today = new Date().toDateString();
            const last = base.lastPracticeDate;
            if (last !== today) {
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                return {
                    ...base,
                    lastPracticeDate: today,
                    streak: last === yesterday ? base.streak + 1 : (last ? 1 : base.streak + 1),
                };
            }
            return base;
        } catch { return { ...INITIAL_USER_STATE }; }
    });

    const [currentUser, setCurrentUser] = useState(null);
    
    // Auth and Firestore Sync
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (fbUser) => {
            setCurrentUser(fbUser);
            if (fbUser) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        if (data.academyProgress) {
                            setUser(data.academyProgress);
                            localStorage.setItem('zion_academy_user', JSON.stringify(data.academyProgress));
                        }
                    }
                } catch (err) {
                    console.error("Error loading academy progress from Firestore:", err);
                }
            }
        });
        return () => unsub();
    }, []);
    
    const [loading, setLoading] = useState(true);
    const [loadingMsg] = useState(() => {
        const hour = new Date().getHours();
        const lastPractice = user.lastPractice ? new Date(user.lastPractice) : null;
        const daysSince = lastPractice ? Math.floor((new Date() - lastPractice) / (1000 * 60 * 60 * 24)) : 0;
        let pose = 'happy';
        let text = '¡Hola de nuevo! 🎵';
        if (hour < 10) { text = '¡Buenos días! Un café y a practicar ☕'; pose = 'happy'; }
        else if (hour > 20) { text = '¿Practicando de noche? ¡Eso es pasión! 🌙'; pose = 'happy'; }
        if (daysSince > 3) { text = '¡Te extrañamos! ¿Listo para volver?'; pose = 'sad'; }
        else if (daysSince === 0 && user.xp > 0) { text = '¡Vas muy bien hoy! Sigamos así 🔥'; pose = 'celebrate'; }
        if (user.xp === 0) { text = '¡Bienvenido! Empecemos tu viaje musical 🚀'; pose = 'happy'; }
        if (Math.random() > 0.7) { pose = 'think'; text = '¿Sabías que la música mejora tu memoria? 🧠'; }
        return { pose, text };
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 4500);
        return () => clearTimeout(timer);
    }, []);

    const [activeLevel, setActiveLevel] = useState(null);
    const [activeLesson, setActiveLesson] = useState(null);
    const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
    const [showSuccess, setShowSuccess] = useState(null); // { xp, perfect }
    const [currentTab, setCurrentTab] = useState('home');
    const [xpToast, setXpToast] = useState(null);
    const [perfectRun, setPerfectRun] = useState(true); // track if any wrong answers
    const [newAchievement, setNewAchievement] = useState(null);

    // Persist user
    useEffect(() => {
        const saveProgress = async () => {
            localStorage.setItem('zion_academy_user', JSON.stringify(user));
            
            if (currentUser) {
                try {
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        academyProgress: user
                    });
                } catch (err) {
                    // If doc doesn't exist yet, we might need setDoc, but Dashboard usually creates it.
                    console.warn("Could not update academyProgress, trying setDoc...", err);
                    try {
                        await setDoc(doc(db, 'users', currentUser.uid), {
                            academyProgress: user
                        }, { merge: true });
                    } catch (innerErr) {
                        console.error("Firestore save failed:", innerErr);
                    }
                }
            }
        };

        const timeout = setTimeout(saveProgress, 1000); // Debounce saves
        return () => clearTimeout(timeout);
    }, [user, currentUser]);


    // Check achievements
    const checkAchievements = useCallback((updatedUser) => {
        ACHIEVEMENTS.forEach(ach => {
            if (!updatedUser.achievements.includes(ach.id) && ach.condition(updatedUser)) {
                setNewAchievement(ach);
                setUser(prev => ({
                    ...prev,
                    achievements: [...prev.achievements, ach.id],
                    xp: prev.xp + ach.xp,
                    gems: prev.gems + 10,
                }));
                setTimeout(() => setNewAchievement(null), 4000);
            }
        });
    }, []);

    // Start a level
    const startLevel = async (levelId, bypassLock = false) => {
        if (!bypassLock && levelId > user.unlockedLevel) return;
        await academyAudio.playNote('E4', '16n');
        const levelData = generateExercises(levelId);
        setPerfectRun(true);
        setActiveLevel(levelData);
        setActiveLesson(levelData.lessons[0]);
        setCurrentExerciseIdx(0);
    };

    // Handle correct answer
    const handleCorrect = useCallback(() => {
        const exercise = activeLesson.exercises[currentExerciseIdx];
        const xpGain = exercise.xpVal || 10;

        setUser(prev => {
            const updated = {
                ...prev,
                xp: prev.xp + xpGain,
                totalAnswered: prev.totalAnswered + 1,
                totalCorrect: prev.totalCorrect + 1,
                earCorrect: (prev.earCorrect || 0) + (
                    ['ear-choice', 'note-id', 'interval-id'].includes(exercise.type) ? 1 : 0
                ),
            };
            return updated;
        });

        setXpToast(xpGain);

        const isLast = currentExerciseIdx >= activeLesson.exercises.length - 1;
        if (isLast) {
            // Level complete!
            const levelXpReward = activeLevel.xpReward || 100;
            setTimeout(async () => {
                await academyAudio.playLevelComplete();
                setUser(prev => {
                    const updated = {
                        ...prev,
                        xp: prev.xp + levelXpReward,
                        unlockedLevel: Math.max(prev.unlockedLevel, (activeLevel.id || 1) + 1),
                        completedLessons: [...new Set([...prev.completedLessons, `${activeLevel.id}`])],
                        level: getUserLevel(prev.xp + levelXpReward),
                    };
                    checkAchievements(updated);
                    return updated;
                });
                setShowSuccess({ xp: levelXpReward, perfect: perfectRun });
            }, 400);
        } else {
            setCurrentExerciseIdx(prev => prev + 1);
        }
    }, [activeLesson, currentExerciseIdx, activeLevel, perfectRun, checkAchievements]);

    // Handle wrong answer
    const handleWrong = useCallback(() => {
        setPerfectRun(false);
        setUser(prev => ({
            ...prev,
            hearts: Math.max(0, prev.hearts - 1),
            totalAnswered: prev.totalAnswered + 1,
        }));
    }, []);

    // ─── VIEWS ────────────────────────────────────────────────────────────────

    const renderHomeScreen = () => {
        const userLevel = getUserLevel(user.xp);
        const xpToNextLevel = getXPToNext(user.xp);
        const currentLevelXP = XP_LEVELS[userLevel - 1] || 0;
        const nextLevelXP = XP_LEVELS[userLevel] || XP_LEVELS[XP_LEVELS.length - 1];
        const levelProgress = ((user.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
        const currentLevelMeta = LEVEL_META[user.unlockedLevel] || {};

        return (
            <div className="home-view fade-in">
                {/* Header */}
                <header className="home-header">
                    <div className="logo-group">
                        <div className="logo-box" style={{ background: 'none', padding: 0, overflow: 'hidden' }}>
                            <img src="/logo2.png" alt="Zion Academy Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <span className="logo-text">Zion Academy</span>
                    </div>
                    <div className="header-pills">
                        <div className="pill gem-pill"><Icon name="diamond" size={14}/> {user.gems}</div>
                        <div className="pill fire-pill"><Icon name="flame" size={14}/> {user.streak}</div>
                        <div className="pill heart-pill"><Icon name="heart" size={14}/> {user.hearts}</div>
                    </div>
                </header>

                {/* Mascot welcoming */}
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
                    <Mascot 
                        pose="happy" 
                        size={100} 
                        speech={`¡Hola! ¿Listo para tocar? 🎹`}
                        speechStyle={{ bottom: '80%' }}
                    />
                </div>

                {/* User Level Card */}
                <div className="user-level-card">
                    <div className="level-info">
                        <span className="level-label">Nivel de usuario</span>
                        <div className="level-number" style={{display:'flex', alignItems:'center', gap:8}}>
                            <Icon name="star" size={22} color="#fcd34d" />
                            Nivel {userLevel}
                        </div>
                        <div className="xp-row">
                            <span className="xp-val">{user.xp} XP</span>
                            <span className="xp-next">→ {xpToNextLevel} XP para Nivel {userLevel + 1}</span>
                        </div>
                        <div className="xp-bar-wrap">
                            <div className="xp-bar-fill" style={{ width: `${Math.min(100, levelProgress)}%` }} />
                        </div>
                    </div>
                    <div style={{ opacity: 0.9 }}>
                        <Icon name={currentLevelMeta.icon || 'music'} size={56} color="#fff" />
                    </div>
                </div>

                {/* Continue Card */}
                <div
                    className="continue-card ui-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => startLevel(user.unlockedLevel)}
                >
                    <div className="continue-info">
                        <span className="label-tag">▶ Continuar aprendiendo</span>
                        <h4 className="continue-title">
                            Nivel {user.unlockedLevel} — {currentLevelMeta.title || `Nivel ${user.unlockedLevel}`}
                        </h4>
                        <div className="type-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {currentLevelMeta.type === 'ear' && <><Icon name="ear" size={13}/> Entrenamiento auditivo</>}
                            {currentLevelMeta.type === 'theory' && <><Icon name="book-open" size={13}/> Teoría musical</>}
                            {currentLevelMeta.type === 'rhythm' && <><Icon name="activity" size={13}/> Ritmo</>}
                            {currentLevelMeta.type === 'piano' && <><Icon name="keyboard" size={13}/> Teclado interactivo</>}
                        </div>
                        <button className="big-continue-btn">Continuar →</button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-row">
                    <div className="stat-box">
                        <div className="stat-num">{accuracy(user)}%</div>
                        <div className="stat-lbl">Precisión</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-num">{user.totalCorrect}</div>
                        <div className="stat-lbl">Correctas</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-num">{user.completedLessons.length}</div>
                        <div className="stat-lbl">Niveles</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-num">{user.achievements.length}</div>
                        <div className="stat-lbl">Logros</div>
                    </div>
                </div>

                {/* Quick Practice */}
                <h3 className="section-heading">Práctica Rápida</h3>
                <div className="quick-grid">
                    {[
                        { icon: 'ear', label: 'Oído Musical', lvl: 5, bg: '#fdf4ff', c: '#d946ef' },
                        { icon: 'keyboard', label: 'Piano', lvl: 10, bg: '#eff6ff', c: '#3b82f6' },
                        { icon: 'book-open', label: 'Teoría', lvl: 2, bg: '#f0fdf4', c: '#22c55e' },
                        { icon: 'layers', label: 'Acordes', lvl: 31, bg: '#fff7ed', c: '#f97316' },
                        { icon: 'activity', label: 'Ritmo', lvl: 11, bg: '#fef2f2', c: '#ef4444' },
                        { icon: 'music', label: 'Intervalos', lvl: 9, bg: '#f8fafc', c: '#64748b' },
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="quick-card"
                            onClick={() => startLevel(item.lvl, true)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="quick-icon" style={{ background: item.bg }}>
                                <Icon name={item.icon} size={24} color={item.c} />
                            </div>
                            <span className="quick-label">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderLearnView = () => {
        return (
            <div className="learn-view fade-in">
                <header className="view-header">
                    <h2 className="heading-l">Aprender</h2>
                </header>

                {ACADEMY_STAGES.map(stage => {
                    const [start, end] = stage.levelsRange;
                    const stageActive = user.unlockedLevel >= start && user.unlockedLevel <= end;
                    return (
                        <div key={stage.id} style={{ marginBottom: 24 }}>
                            {/* Stage header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 18px',
                                background: stageActive ? stage.color + '10' : '#f8fafc',
                                borderRadius: 16,
                                marginBottom: 12,
                                border: `1px solid ${stageActive ? stage.color + '30' : '#e2e8f0'}`,
                            }}>
                                <div style={{ 
                                    width: 44, height: 44, borderRadius: 12, 
                                    background: stageActive ? stage.color : '#e2e8f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Icon name={stage.icon} size={24} color={stageActive ? '#fff' : '#94a3b8'} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{stage.title}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        {Math.min(end, user.unlockedLevel - 1) - start + 1 > 0
                                            ? `${Math.max(0, Math.min(end, user.unlockedLevel - 1) - start + 1)} de ${end - start + 1} completados`
                                            : 'No comenzado'
                                        }
                                    </div>
                                </div>
                                {stageActive && (
                                    <div style={{
                                        background: stage.color, color: '#fff',
                                        fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 100,
                                    }}>ACTIVO</div>
                                )}
                            </div>

                            {/* Level list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                                {Array.from({ length: end - start + 1 }, (_, i) => start + i)
                                    .filter(lvl => LEVEL_META[lvl] || lvl <= 20) // only show levels with metadata or first 20
                                    .slice(0, 10)
                                    .map(lvl => {
                                        const meta = LEVEL_META[lvl] || { title: `Nivel ${lvl}`, icon: 'music', type: 'theory' };
                                        const isCompleted = user.completedLessons.includes(`${lvl}`);
                                        const isCurrent = lvl === user.unlockedLevel;
                                        const isLocked = lvl > user.unlockedLevel;
                                        return (
                                            <div
                                                key={lvl}
                                                className={`path-item ${isCompleted ? 'completed' : isCurrent ? 'current-lvl' : isLocked ? 'locked' : ''}`}
                                                onClick={() => !isLocked && startLevel(lvl)}
                                                style={{ cursor: isLocked ? 'default' : 'pointer', borderColor: isCurrent ? stage.color : 'transparent' }}
                                            >
                                                <div className="path-dot" style={{
                                                    background: isCompleted ? '#22c55e' : isCurrent ? stage.color : '#f1f5f9',
                                                }}>
                                                    {isCompleted ? <Icon name="check" size={20} color="#fff" />
                                                    : isLocked ? <Icon name="lock" size={20} color="#94a3b8" />
                                                    : <Icon name={meta.icon} size={20} color={isCurrent ? '#fff' : '#64748b'} />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: isLocked ? '#94a3b8' : '#1e293b' }}>
                                                        {meta.title}
                                                    </div>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', display: 'flex', gap: 8, marginTop: 4 }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            {isCompleted ? <><Icon name="check-circle-2" size={12} color="#22c55e"/> Completado</> 
                                                            : isCurrent ? <><Icon name="play-circle" size={12} color={stage.color}/> En progreso</> 
                                                            : isLocked ? <><Icon name="lock" size={12}/> Bloqueado</> 
                                                            : <><Icon name="circle-dashed" size={12}/> Disponible</>}
                                                        </span>
                                                    </div>
                                                </div>
                                                {!isLocked && (
                                                    <div style={{ color: '#cbd5e1' }}><Icon name="chevron-right" size={20} /></div>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderPracticeView = () => {
        const practiceCategories = [
            { icon: 'ear', label: 'Entrenamiento Auditivo', desc: 'Intervalos y notas por oído', levels: [5, 7, 9, 25, 26], color: '#8b5cf6' },
            { icon: 'keyboard', label: 'Teclado Interactivo', desc: 'Aprende a ubicar notas', levels: [10], color: '#6366f1' },
            { icon: 'book-open', label: 'Teoría Musical', desc: 'Pentagrama, claves y figuras', levels: [1, 2, 3, 4, 6, 8, 11, 12], color: '#0ea5e9' },
            { icon: 'layers', label: 'Acordes y Armonía', desc: 'Tríadas, inversiones, progresiones', levels: [31, 32, 33, 34], color: '#f59e0b' },
            { icon: 'activity', label: 'Ritmo y Tiempo', desc: 'Compases, figuras y tempo', levels: [11, 12, 13, 14], color: '#10b981' },
            { icon: 'rainbow', label: 'Escalas y Modos', desc: 'Mayor, menor y modos griegos', levels: [21, 22, 23, 24], color: '#ef4444' },
        ];

        return (
            <div className="practice-view fade-in">
                <header className="view-header">
                    <h2 className="heading-l">Práctica</h2>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Elige una categoría</span>
                </header>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {practiceCategories.map((cat, i) => {
                        const bestLevel = cat.levels.find(l => l <= user.unlockedLevel) || cat.levels[0];
                        const available = bestLevel <= user.unlockedLevel;
                        return (
                            <div
                                key={i}
                                className="practice-cat-card"
                                onClick={() => available && startLevel(bestLevel)}
                                style={{ cursor: available ? 'pointer' : 'default', opacity: available ? 1 : 0.5 }}
                            >
                                <div className="cat-icon" style={{ background: cat.color + '15' }}>
                                    <Icon name={cat.icon} size={24} color={cat.color} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{cat.label}</div>
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{cat.desc}</div>
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: cat.color }}>
                                    {available ? `▶ Nivel ${bestLevel}` : '🔒'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderProgressView = () => {
        const acc = accuracy(user);
        const userLevel = getUserLevel(user.xp);
        const circumference = 2 * Math.PI * 45;
        const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        const maxWeeklyXP = Math.max(...(user.weeklyXP || [1]));

        return (
            <div className="progress-view fade-in">
                <header className="view-header">
                    <h2 className="heading-l">Progreso</h2>
                </header>

                {/* Accuracy Ring */}
                <div className="ui-card accuracy-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <svg width={100} height={100} style={{ flexShrink: 0 }}>
                            <circle cx={50} cy={50} r={45} fill="none" stroke="#e2e8f0" strokeWidth={8} />
                            <circle
                                cx={50} cy={50} r={45} fill="none"
                                stroke={acc >= 80 ? '#22c55e' : acc >= 60 ? '#f59e0b' : '#ef4444'}
                                strokeWidth={8}
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference - (circumference * acc / 100)}
                                strokeLinecap="round"
                                transform="rotate(-90 50 50)"
                            />
                            <text x={50} y={46} textAnchor="middle" fontSize={18} fontWeight={800} fill="#1e293b">{acc}%</text>
                            <text x={50} y={60} textAnchor="middle" fontSize={9} fill="#64748b">Precisión</text>
                        </svg>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                    { label: 'XP Total', val: user.xp },
                                    { label: 'Racha', val: <span style={{display:'flex', alignItems:'center', justifyContent:'center', gap:4}}>{user.streak} <Icon name="flame" size={18} color="#d97706"/></span> },
                                    { label: 'Nivel', val: userLevel },
                                    { label: 'Correctas', val: user.totalCorrect },
                                    { label: 'Más XP diarios', val: `${(user.weeklyXP || [0]).reduce((a,b)=>a+b,0)}` },
                                    { label: 'Logros', val: `${user.achievements.length}/${ACHIEVEMENTS.length}` },
                                ].map(({ label, val }) => (
                                    <div key={label}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{val}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Weekly Activity */}
                <div className="ui-card" style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Actividad Semanal</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
                        {(user.weeklyXP || [0, 0, 0, 0, 0, 0, 0]).map((xp, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{
                                    width: '100%',
                                    height: maxWeeklyXP > 0 ? `${(xp / maxWeeklyXP) * 44}px` : '4px',
                                    minHeight: 4,
                                    background: xp > 0 ? 'linear-gradient(180deg, #6366f1, #8b5cf6)' : '#e2e8f0',
                                    borderRadius: 4,
                                    transition: 'height 0.3s',
                                }} />
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>{weekDays[i]}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* XP Level Progress */}
                <div className="ui-card" style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="star" size={18} color="#fcd34d" /> Nivel {userLevel} → {userLevel + 1}
                    </div>
                    <div style={{ height: 12, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min(100, ((user.xp - (XP_LEVELS[userLevel - 1] || 0)) / ((XP_LEVELS[userLevel] || 10000) - (XP_LEVELS[userLevel - 1] || 0))) * 100)}%`,
                            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                            borderRadius: 6,
                            transition: 'width 0.5s ease',
                        }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                        {getXPToNext(user.xp)} XP para el siguiente nivel
                    </div>
                </div>

                {/* Achievements */}
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="trophy" size={18} color="#f59e0b" /> Logros
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {ACHIEVEMENTS.map(ach => {
                            const earned = user.achievements.includes(ach.id);
                            return (
                                <div key={ach.id} className="ui-card achievement-card" style={{
                                    opacity: earned ? 1 : 0.4,
                                    background: earned ? '#ede9fe' : '#f8fafc',
                                    border: earned ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
                                    padding: '12px',
                                    borderRadius: 14,
                                }}>
                                    <div style={{ marginBottom: 6, opacity: earned ? 1 : 0.5, color: '#6366f1' }}>
                                        <Icon name={ach.icon} size={26} color="currentColor" />
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>{ach.title}</div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{ach.desc}</div>
                                    {earned && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#7c3aed', fontWeight: 700, marginTop: 4 }}>
                                        +{ach.xp} XP <Icon name="check" size={12} strokeWidth={3} />
                                    </div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderProfileView = () => {
        const userLevel = getUserLevel(user.xp);
        const titles = ['Oyente Curioso', 'Aprendiz Musical', 'Estudiante', 'Músico', 'Teórico', 'Virtuoso', 'Maestro'];
        const titleIdx = Math.min(Math.floor((user.unlockedLevel - 1) / 8), titles.length - 1);

        return (
            <div className="profile-view fade-in">
                <header className="view-header">
                    <h2 className="heading-l">Perfil</h2>
                    <button
                        onClick={() => {
                            if (confirm('¿Reiniciar todo el progreso?')) {
                                localStorage.removeItem('zion_academy_user');
                                setUser({ ...INITIAL_USER_STATE });
                            }
                        }}
                        style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}
                    >
                        Reiniciar
                    </button>
                </header>

                <div className="ui-card" style={{ textAlign: 'center', padding: 28 }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                        overflow: 'hidden'
                    }}>
                        <img src="/logo2.png" alt="Zion Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Músico Zion Academy</h3>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                        {titles[titleIdx]} · Nivel {userLevel}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
                        {[
                            { label: 'XP Total', val: user.xp, icon: '⭐' },
                            { label: 'Racha', val: `${user.streak}d`, icon: '🔥' },
                            { label: 'Precisión', val: `${accuracy(user)}%`, icon: '🎯' },
                        ].map(({ label, val, icon }) => (
                            <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: 12 }}>
                                <div style={{ fontSize: 20 }}>{icon}</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>{val}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Instrument tips based on progress */}
                <div className="ui-card" style={{ marginTop: 16, background: 'linear-gradient(135deg, #ede9fe, #faf5ff)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#7c3aed' }}>🎓 Tu Camino Musical</div>
                    <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                        Has completado <strong>{user.completedLessons.length} lecciones</strong> con <strong>{user.totalCorrect} respuestas correctas</strong>.
                        {user.unlockedLevel < 5 && ' Sigue practicando los fundamentos para desbloquear el entrenamiento auditivo.'}
                        {user.unlockedLevel >= 5 && user.unlockedLevel < 15 && ' Ya puedes empezar el entrenamiento auditivo. ¡Tu oído musical está mejorando!'}
                        {user.unlockedLevel >= 15 && ' Excelente progreso. Estás en el camino de los músicos serios.'}
                    </div>
                </div>
            </div>
        );
    };

    // ─── SUCCESS SCREEN ───────────────────────────────────────────────────────
    const renderSuccessScreen = () => (
        <div className="lesson-success-flow">
            <div className="success-content ui-card">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                    <Mascot 
                        pose={showSuccess?.perfect ? "celebrate" : "happy"} 
                        size={120} 
                        speech={showSuccess?.perfect ? "¡INCREÍBLE! 🌟" : "¡Lo logramos! 🎵"}
                        speechStyle={{ fontSize: 16, padding: '10px 20px', bottom: '85%' }}
                    />
                </div>
                <h1 className="heading-xl" style={{ color: '#1e293b', marginTop: 10 }}>
                    {showSuccess?.perfect ? '¡Perfecto!' : '¡Nivel Completado!'}
                </h1>
                <p className="body-l" style={{ color: '#64748b' }}>
                    {showSuccess?.perfect
                        ? 'Sin ningún error. Tu concentración es impresionante.'
                        : 'Sigue practicando para mejorar la precisión.'}
                </p>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '20px 0' }}>
                    <div className="xp-badge">+{showSuccess?.xp} XP</div>
                    {showSuccess?.perfect && <div className="xp-badge" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#d97706' }}>
                        <Icon name="medal" size={16} color="currentColor" /> Perfecto
                    </div>}
                </div>
                <button
                    className="ui-button-primary"
                    style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 16 }}
                    onClick={() => {
                        setActiveLesson(null);
                        setActiveLevel(null);
                        setShowSuccess(null);
                        setCurrentTab('learn');
                    }}
                >
                    Continuar →
                </button>
                <button
                    style={{ width: '100%', marginTop: 12, padding: '12px', background: 'none', border: '2px solid #e2e8f0', borderRadius: 16, cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: 14 }}
                    onClick={() => {
                        setActiveLesson(null);
                        setActiveLevel(null);
                        setShowSuccess(null);
                        setCurrentTab('home');
                    }}
                >
                    Ir al inicio
                </button>
            </div>
            <style>{`@keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}`}</style>
        </div>
    );

    // ─── ACHIEVEMENT POPUP ────────────────────────────────────────────────────
    const renderAchievementPopup = () => newAchievement && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#fff', borderRadius: 24, padding: 32, maxWidth: 320, textAlign: 'center',
                boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                animation: 'toastIn 0.4s ease',
            }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>{newAchievement.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                    ¡Nuevo Logro!
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>{newAchievement.title}</h3>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>{newAchievement.desc}</p>
                <div style={{ background: '#ede9fe', color: '#7c3aed', fontWeight: 800, borderRadius: 100, padding: '8px 20px', display: 'inline-block' }}>
                    +{newAchievement.xp} XP
                </div>
            </div>
        </div>
    );

    // ─── MAIN RENDER ──────────────────────────────────────────────────────────
    return (
        <div className="academy-page">
            {loading && <LoadingScreen loadingMsg={loadingMsg} />}
            {/* XP Toast */}
            {xpToast && <XPToast amount={xpToast} onDone={() => setXpToast(null)} />}

            {/* Achievement popup */}
            {renderAchievementPopup()}

            {activeLesson ? (
                <div className="lesson-frame-flow">
                    {showSuccess ? (
                        renderSuccessScreen()
                    ) : (
                        <ExercisePlayer
                            exercise={activeLesson.exercises[currentExerciseIdx]}
                            onCorrect={handleCorrect}
                            onWrong={handleWrong}
                            onExit={() => {
                                setActiveLesson(null);
                                setActiveLevel(null);
                                setShowSuccess(null);
                            }}
                            progress={((currentExerciseIdx) / activeLesson.exercises.length) * 100}
                            hearts={user.hearts}
                        />
                    )}
                </div>
            ) : (
                <>
                    <main className="content-scroll">
                        {currentTab === 'home'     && renderHomeScreen()}
                        {currentTab === 'learn'    && renderLearnView()}
                        {currentTab === 'practice' && renderPracticeView()}
                        {currentTab === 'progress' && renderProgressView()}
                        {currentTab === 'profile'  && renderProfileView()}
                    </main>

                    {/* Bottom Nav */}
                    <nav className="fixed-bottom-nav">
                        {[
                            { id: 'home',     label: 'Inicio',  icon: 'home'     },
                            { id: 'learn',    label: 'Aprender', icon: 'learn'   },
                            { id: 'practice', label: 'Práctica', icon: 'practice'},
                            { id: 'progress', label: 'Progreso', icon: 'progress'},
                            { id: 'profile',  label: 'Perfil',   icon: 'profile' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                className={`nav-item ${currentTab === tab.id ? 'active' : ''}`}
                                onClick={() => setCurrentTab(tab.id)}
                            >
                                <Icon name={tab.icon} size={22} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </>
            )}

            <style>{`
                .academy-page { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: var(--bg-main, #f8fafc); overflow: hidden; }
                .academy-page * { box-sizing: border-box; }
                .content-scroll { flex: 1; overflow-y: auto; padding: 16px 16px 100px; max-width: 520px; margin: 0 auto; width: 100%; position: relative; }

                .fade-in { animation: fadeIn 0.3s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

                /* Home */
                .home-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .logo-group { display: flex; align-items: center; gap: 8px; }
                .logo-box { width: 36px; height: 36px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }
                .logo-text { font-size: 20px; font-weight: 800; color: #1e293b; }
                .header-pills { display: flex; gap: 8px; }
                .pill { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 100px; font-size: 13px; font-weight: 700; }
                .gem-pill { background: #ede9fe; color: #7c3aed; }
                .fire-pill { background: #fef3c7; color: #d97706; }
                .heart-pill { background: #fee2e2; color: #ef4444; }

                /* User level card */
                .user-level-card {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border-radius: 20px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 16px;
                    color: #fff;
                }
                .level-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
                .level-number { font-size: 22px; font-weight: 800; margin: 2px 0; }
                .xp-row { display: flex; gap: 10px; align-items: center; font-size: 12px; opacity: 0.85; margin: 4px 0 8px; }
                .xp-val { font-weight: 800; }
                .xp-next { opacity: 0.7; }
                .xp-bar-wrap { height: 6px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden; }
                .xp-bar-fill { height: 100%; background: #fff; border-radius: 3px; transition: width 0.5s; }

                /* Continue card */
                .continue-card { margin-bottom: 20px; padding: 24px !important; background: #fff !important; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .label-tag { font-size: 11px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; }
                .continue-title { font-size: 18px; font-weight: 900; color: #1e293b; margin: 8px 0 10px; }
                .type-pill {
                    display: inline-block;
                    font-size: 11px; font-weight: 600;
                    background: #ede9fe; color: #7c3aed;
                    padding: 3px 10px; border-radius: 100px;
                    margin-bottom: 12px;
                }
                .big-continue-btn {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: #fff;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .big-continue-btn:hover { transform: translateY(-1px); }

                /* Stats row */
                .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
                .stat-box { background: #fff; border-radius: 14px; padding: 12px 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
                .stat-num { font-size: 20px; font-weight: 800; color: #1e293b; }
                .stat-lbl { font-size: 10px; color: #94a3b8; margin-top: 2px; }

                /* Quick practice */
                .section-heading { font-size: 16px; font-weight: 800; color: #1e293b; margin-bottom: 12px; }
                .quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .quick-card { background: #fff; border-radius: 16px; padding: 14px 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.2s; }
                .quick-card:hover { transform: translateY(-2px); }
                .quick-icon { font-size: 26px; height: 40px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 12px; margin-bottom: 8px; }
                .quick-label { font-size: 11px; font-weight: 600; color: #475569; }

                /* Learn view */
                .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; width: 100%; }
                .path-item { display: flex; align-items: center; gap: 12px; padding: 14px; background: #fff; border-radius: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.2s; border: 2px solid transparent; width: 100%; }
                .path-item:hover:not(.locked) { box-shadow: 0 4px 14px rgba(0,0,0,0.08); transform: translateY(-1px); }
                .path-dot { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; font-weight: 700; }

                /* Practice */
                .practice-cat-card { display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.2s; }
                .practice-cat-card:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.1); transform: translateX(3px); }
                .cat-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }

                /* Progress */
                .accuracy-card { padding: 20px !important; }
                .achievement-card { box-shadow: none !important; }

                /* Success */
                .lesson-frame-flow { position: fixed; inset: 0; background: var(--bg-main, #f8fafc); z-index: 2000; overflow-y: auto; }
                .lesson-success-flow { display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 24px; }
                .success-content { max-width: 380px; width: 100%; text-align: center; padding: 32px !important; }
                .xp-badge { background: #ede9fe; color: #7c3aed; padding: 10px 20px; border-radius: 100px; font-weight: 800; display: inline-block; font-size: 15px; }

                /* Bottom nav */
                .fixed-bottom-nav {
                    position: fixed; bottom: 0; left: 0; right: 0;
                    background: #fff;
                    display: flex;
                    border-top: 1px solid #f1f5f9;
                    z-index: 1000;
                    max-width: 520px;
                    margin: 0 auto;
                    padding: 8px 0 max(8px, env(safe-area-inset-bottom));
                }
                .nav-item {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 3px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 6px 4px;
                    color: #94a3b8;
                    font-size: 10px;
                    font-weight: 600;
                    transition: color 0.2s;
                }
                .nav-item.active { color: #6366f1; }
                .nav-item.active svg { stroke: #6366f1; }
            `}</style>
        </div>
    );
};

export default Academy;
