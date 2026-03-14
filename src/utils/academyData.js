/**
 * academyData.js  — Zion Academy  (FULL v2.0)
 * Comprehensive music curriculum: 5 Stages | 50 Levels
 * Theory + Ear Training + Rhythm + Sight-Reading + Chords
 */

// ─────────────────────────────────────────────
//  STAGES
// ─────────────────────────────────────────────
export const ACADEMY_STAGES = [
    { id: 'fundamentos',   title: 'Fundamentos',    color: '#4CAF50', levelsRange: [1,  10], icon: 'leaf' },
    { id: 'ritmo',         title: 'Ritmo & Tiempo', color: '#2196F3', levelsRange: [11, 20], icon: 'activity' },
    { id: 'melodia',       title: 'Melodía & Oído', color: '#9C27B0', levelsRange: [21, 30], icon: 'music' },
    { id: 'armonia',       title: 'Armonía',        color: '#FF9800', levelsRange: [31, 40], icon: 'layers' },
    { id: 'avanzado',      title: 'Avanzado',       color: '#F44336', levelsRange: [41, 50], icon: 'trophy' },
];

// ─────────────────────────────────────────────
//  USER STATE
// ─────────────────────────────────────────────
export const INITIAL_USER_STATE = {
    xp: 0,
    gems: 50,
    hearts: 5,
    maxHearts: 5,
    streak: 0,
    lastPracticeDate: null,
    completedLessons: [],
    unlockedLevel: 1,
    totalAnswered: 0,
    totalCorrect: 0,
    achievements: [],
    weeklyXP: [0, 0, 0, 0, 0, 0, 0],
    level: 1,
};

// ─────────────────────────────────────────────
//  ACHIEVEMENTS
// ─────────────────────────────────────────────
export const ACHIEVEMENTS = [
    { id: 'first_note',    title: 'Primera Nota',      desc: 'Completa tu primer ejercicio',    icon: 'music', xp: 50,  condition: u => u.totalAnswered >= 1 },
    { id: 'streak_3',      title: 'En Racha',          desc: 'Practica 3 días seguidos',        icon: 'flame', xp: 100, condition: u => u.streak >= 3 },
    { id: 'streak_7',      title: 'Semana Perfecta',   desc: 'Practica 7 días seguidos',        icon: 'zap', xp: 300, condition: u => u.streak >= 7 },
    { id: 'perfect_heart', title: 'Corazón Perfecto',  desc: 'Completa un nivel sin errores',   icon: 'heart', xp: 150, condition: u => u.hearts === 5 },
    { id: 'level_5',       title: 'Aprendiz',          desc: 'Alcanza el nivel 5',              icon: 'star', xp: 200, condition: u => u.unlockedLevel >= 5 },
    { id: 'level_10',      title: 'Estudiante',        desc: 'Alcanza el nivel 10',             icon: 'sparkles', xp: 400, condition: u => u.unlockedLevel >= 10 },
    { id: 'xp_500',        title: 'Coleccionista XP',  desc: 'Acumula 500 XP',                 icon: 'gem', xp: 100, condition: u => u.xp >= 500 },
    { id: 'ear_master',    title: 'Oído de Oro',       desc: 'Completa 10 ejercicios de oído', icon: 'ear', xp: 250, condition: u => (u.earCorrect || 0) >= 10 },
];

// ─────────────────────────────────────────────
//  LEVEL TITLE MAP
// ─────────────────────────────────────────────
export const LEVEL_META = {
    1:  { title: 'Sonido y Silencio',        icon: 'volume-x', type: 'theory',    xpReward: 50  },
    2:  { title: 'Las 7 Notas Musicales',    icon: 'music-2', type: 'theory',    xpReward: 60  },
    3:  { title: 'El Pentagrama',            icon: 'file-text', type: 'theory',    xpReward: 70  },
    4:  { title: 'Clave de Sol',             icon: 'music-3', type: 'ear',       xpReward: 80  },
    5:  { title: 'Alturas: Agudo vs Grave',  icon: 'trending-up', type: 'ear',       xpReward: 90  },
    6:  { title: 'El Pulso',                 icon: 'heart-pulse', type: 'rhythm',    xpReward: 100 },
    7:  { title: 'Notas Do Re Mi',           icon: 'music', type: 'ear',       xpReward: 110 },
    8:  { title: 'Sostenidos y Bemoles',     icon: 'hash',  type: 'theory',    xpReward: 120 },
    9:  { title: 'Intervalos Básicos',       icon: 'ruler', type: 'ear',       xpReward: 130 },
    10: { title: 'Teclado Piano',            icon: 'keyboard', type: 'piano',     xpReward: 150 },
    11: { title: 'Figuras Rítmicas',         icon: 'music',  type: 'theory',    xpReward: 100 },
    12: { title: 'El Compás 4/4',            icon: 'bar-chart', type: 'rhythm',    xpReward: 110 },
    13: { title: 'Compás 3/4 (Vals)',        icon: 'users', type: 'rhythm',    xpReward: 120 },
    14: { title: 'Corcheas y Síncopas',      icon: 'activity', type: 'theory',    xpReward: 130 },
    15: { title: 'Tempo y BPM',             icon: 'timer', type: 'theory',    xpReward: 140 },
    16: { title: 'Ritmo por Oído',           icon: 'ear', type: 'ear',       xpReward: 150 },
    17: { title: 'El Puntillo',              icon: 'circle',  type: 'theory',    xpReward: 160 },
    18: { title: 'Semicorcheas',             icon: 'music-4', type: 'theory',    xpReward: 170 },
    19: { title: 'Contratiempo',             icon: 'refresh-ccw', type: 'rhythm',    xpReward: 180 },
    20: { title: 'Ritmo Avanzado',           icon: 'activity', type: 'rhythm',    xpReward: 200 },
    21: { title: 'Escala de Do Mayor',       icon: 'sun', type: 'ear',       xpReward: 150 },
    22: { title: 'Escala de Sol Mayor',      icon: 'sun', type: 'ear',       xpReward: 160 },
    23: { title: 'Escala de Re Mayor',       icon: 'sunrise', type: 'ear',       xpReward: 170 },
    24: { title: 'La Menor Natural',         icon: 'moon', type: 'ear',       xpReward: 180 },
    25: { title: 'Oído Musical: 2das y 3ras',icon: 'music', type: 'ear',       xpReward: 190 },
    26: { title: 'Oído: 4tas y 5tas',        icon: 'music-2', type: 'ear',       xpReward: 200 },
    27: { title: 'Intervalos Melódicos',     icon: 'trending-up', type: 'ear',       xpReward: 210 },
    28: { title: 'Intervalos Armónicos',     icon: 'layers', type: 'ear',       xpReward: 220 },
    29: { title: 'El Círculo de Quintas',    icon: 'circle', type: 'theory',    xpReward: 240 },
    30: { title: 'Lectura Musical I',        icon: 'book-open', type: 'piano',     xpReward: 300 },
    31: { title: 'Tríadas Mayores',          icon: 'layers', type: 'ear',       xpReward: 200 },
    32: { title: 'Tríadas Menores',          icon: 'layers', type: 'ear',       xpReward: 210 },
    33: { title: 'Dominante y Subdominante', icon: 'zap', type: 'theory',    xpReward: 220 },
    34: { title: 'Progresión I-IV-V',        icon: 'refresh-ccw', type: 'theory',    xpReward: 230 },
    35: { title: 'Acordes de Séptima',       icon: 'hash', type: 'ear',       xpReward: 250 },
    40: { title: 'Armonía Funcional',        icon: 'music-3', type: 'theory',    xpReward: 300 },
    41: { title: 'Modos Griegos',            icon: 'landmark', type: 'theory',    xpReward: 300 },
    42: { title: 'Transposición',            icon: 'arrow-left-right', type: 'theory',    xpReward: 320 },
    50: { title: 'Maestro Musical',          icon: 'trophy', type: 'theory',    xpReward: 500 },
};

// ─────────────────────────────────────────────
//  NOTE FREQUENCIES (para Audio Engine)
// ─────────────────────────────────────────────
export const NOTE_FREQS = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C#4': 277.18, 'D#4': 311.13, 'F#4': 369.99, 'G#4': 415.30, 'A#4': 466.16,
    'C#5': 554.37, 'D#5': 622.25, 'F#5': 739.99,
};

export const KEYS_ON_PIANO = ['C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4','C5','C#5','D5','D#5','E5'];
export const WHITE_KEYS    = ['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5'];
export const BLACK_KEYS    = ['C#4','D#4','F#4','G#4','A#4','C#5','D#5'];

// ─────────────────────────────────────────────
//  EXERCISE GENERATOR
// ─────────────────────────────────────────────
export const generateExercises = (levelId) => {
    const lid = parseInt(levelId);
    const meta = LEVEL_META[lid] || { title: `Nivel ${lid}`, icon: '🎵', type: 'theory', xpReward: 100 };
    return {
        id: lid,
        title: meta.title,
        icon: meta.icon,
        type: meta.type,
        xpReward: meta.xpReward,
        lessons: getLessonsForLevel(lid),
    };
};

/**
 * Shuffle the options of a choice exercise so the correct answer
 * is NOT always in position 0. Returns a NEW exercise object.
 * Only applies to choice-type exercises (not piano, not interval-id with notes).
 */
function shuffleExercise(ex) {
    // Piano and pure-audio exercises don't have shuffleable options
    if (ex.type === 'piano' || !ex.options || ex.options.length === 0) return ex;

    const correctText = ex.options[ex.correct];
    // Fisher-Yates shuffle on a copy
    const shuffled = [...ex.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const newCorrectIdx = shuffled.indexOf(correctText);
    return { ...ex, options: shuffled, correct: newCorrectIdx };
}

function getLessonsForLevel(lid) {
    const db = LESSONS_DB;
    const lessons = db[lid] || db[1];
    // Return lessons with shuffled options so correct answer is random
    return lessons.map(lesson => ({
        ...lesson,
        exercises: lesson.exercises.map(shuffleExercise),
    }));
}

// ─────────────────────────────────────────────
//  LESSONS DATABASE
// ─────────────────────────────────────────────
export const LESSONS_DB = {
    1: [{
        id: '1.1', title: 'Sonido y Silencio', type: 'multi-choice',
        exercises: [
            { type:'choice', q: '¿Qué es el SONIDO en música?', options: ['Vibración que percibimos con los oídos','El volumen máximo','El nombre de una nota'], correct: 0, explanation: 'El sonido es energía vibracional que viaja por el aire y percibimos con nuestros oídos.', xpVal: 10 },
            { type:'choice', q: 'El SILENCIO en música representa...', options: ['Un momento sin sonido','Una nota muy grave','Un tempo rápido'], correct: 0, explanation: 'El silencio es tan importante como el sonido; estructura el ritmo y la expresividad.', xpVal: 10 },
            { type:'choice', q: '¿Cuáles son las 4 propiedades del sonido?', options: ['Altura, Duración, Timbre, Intensidad','Color, Textura, Peso, Forma','Nota, Compás, Tempo, Escala'], correct: 0, explanation: 'Altura (agudo/grave), Duración (largo/corto), Timbre (color sonoro), Intensidad (fuerte/suave).', xpVal: 15 },
            { type:'choice', q: '¿Qué propiedad del sonido diferencia un piano de una guitarra tocando la misma nota?', options: ['El Timbre','La Altura','La Duración'], correct: 0, explanation: 'El timbre (o color sonoro) es la "huella dactilar" de cada instrumento.', xpVal: 15 },
            { type:'choice', q: 'Un sonido AGUDO tiene...', options: ['Frecuencia alta (muchas vibraciones)','Frecuencia baja (pocas vibraciones)','Mucho volumen'], correct: 0, explanation: 'Los sonidos agudos vibran más rápido (más Hz). Los graves vibran más lento.', xpVal: 10 },
        ]
    }],
    2: [{
        id: '2.1', title: 'Las 7 Notas', type: 'multi-choice',
        exercises: [
            { type:'choice', q: '¿Cuáles son las 7 notas musicales en orden?', options: ['Do, Re, Mi, Fa, Sol, La, Si','Do, Mi, Sol, Si, Re, Fa, La','La, Si, Do, Re, Mi, Fa, Sol'], correct: 0, explanation: 'La escala diatónica: Do-Re-Mi-Fa-Sol-La-Si. ¡Como en Do Re Mi de Sound of Music!', xpVal: 10 },
            { type:'choice', q: '¿Qué nota está ENTRE Mi y Sol?', options: ['Fa','Re','La'], correct: 0, explanation: 'Do-Re-Mi-FA-Sol. Fa está exactamente entre Mi y Sol.', xpVal: 10 },
            { type:'choice', q: '¿Cuántas notas tiene la escala musical básica?', options: ['7','5','12'], correct: 0, explanation: 'La escala diatónica tiene 7 notas. Si contamos sostenidos/bemoles llegamos a 12 notas distintas.', xpVal: 10 },
            { type:'choice', q: 'En inglés, las notas se nombran con letras. ¿Cuál es el Do en inglés?', options: ['C','A','G'], correct: 0, explanation: 'En el sistema anglosajón: C=Do, D=Re, E=Mi, F=Fa, G=Sol, A=La, B=Si.', xpVal: 15 },
            { type:'choice', q: 'La nota que está DOS pasos arriba de La es...', options: ['Do','Si','Re'], correct: 0, explanation: 'La→Si (paso 1)→Do (paso 2). ¡La escala es circular!', xpVal: 15 },
        ]
    }],
    3: [{
        id: '3.1', title: 'El Pentagrama', type: 'multi-choice',
        exercises: [
            { type:'choice', q: 'El pentagrama tiene...', options: ['5 líneas y 4 espacios','4 líneas y 5 espacios','6 líneas y 5 espacios'], correct: 0, explanation: 'El pentagrama (del griego "penta"=cinco) tiene exactamente 5 líneas paralelas entre las que hay 4 espacios.', xpVal: 10 },
            { type:'choice', q: '¿Dónde se escriben las notas en el pentagrama?', options: ['Sobre las líneas y en los espacios','Solo sobre las líneas','Solo en los espacios'], correct: 0, explanation: 'Las notas pueden colocarse sobre las 5 líneas O dentro de los 4 espacios que hay entre ellas.', xpVal: 10 },
            { type:'choice', q: '¿Para qué sirven las "líneas adicionales"?', options: ['Para escribir notas muy agudas o muy graves','Para separar compases','Para indicar el tempo'], correct: 0, explanation: 'Las líneas adicionales (ledger lines) extienden el pentagrama hacia arriba o abajo para notas extremas.', xpVal: 15 },
            { type:'choice', q: 'La barra vertical que divide el pentagrama en partes se llama...', options: ['Barra de compás','Clave','Ligadura'], correct: 0, explanation: 'La barra de compás divide el pentagrama en compases, que son las "unidades" de tiempo organizadas.', xpVal: 15 },
        ]
    }],
    4: [{
        id: '4.1', title: 'Clave de Sol', type: 'multi-choice',
        exercises: [
            { type:'choice', q: 'La Clave de Sol indica que la nota Sol está en la...', options: ['Segunda línea','Primera línea','Tercera línea'], correct: 0, explanation: 'La Clave de Sol (o clave de Violín) "envuelve" la segunda línea, que es donde se escribe la nota Sol4.', xpVal: 10 },
            { type:'choice', q: '¿En qué línea del pentagrama (en clave de Sol) está el Mi?', options: ['Primera línea','Segunda línea','Tercera línea'], correct: 0, explanation: 'La primera línea del pentagrama en clave de Sol corresponde a Mi4.', xpVal: 10 },
            { type:'choice', q: '¿Qué nota aparece en el PRIMER ESPACIO en clave de Sol?', options: ['Fa','La','Do'], correct: 0, explanation: 'El primer espacio (entre líneas 1 y 2) corresponde a Fa4 en clave de Sol.', xpVal: 15 },
            { type:'choice', q: 'El "Do Central" en clave de Sol se escribe...', options: ['En una línea adicional debajo del pentagrama','En la primera línea','En el primer espacio'], correct: 0, explanation: 'El Do Central (Do4) está una línea debajo del pentagrama, en una "ledger line".', xpVal: 15 },
            { type:'choice', q: '¿Para qué se usa principalmente la Clave de Sol?', options: ['Instrumentos de sonido agudo (violín, flauta, mano derecha del piano)','Instrumentos graves (cello, bajo, mano izquierda)','Percusión'], correct: 0, explanation: 'La Clave de Sol es para voces e instrumentos de registro medio-agudo. Los graves usan la Clave de Fa.', xpVal: 10 },
        ]
    }],
    5: [{
        id: '5.1', title: 'Agudo vs Grave', type: 'ear-training',
        exercises: [
            { type:'ear-choice', q: 'Escucha y elige: ¿La segunda nota es más AGUDA o más GRAVE que la primera?', audio1:'C4', audio2:'G4', options:['Más Aguda','Más Grave','Igual'], correct: 0, explanation: 'Sol4 es más agudo que Do4. Va más arriba en el teclado.', xpVal: 15 },
            { type:'ear-choice', q: '¿Esta nota es AGUDA o GRAVE?', audio1:'C3', options:['Grave','Aguda'], correct: 0, explanation: 'Do3 es una nota grave. Está en el registro bajo del piano.', xpVal: 15 },
            { type:'ear-choice', q: '¿Esta nota es AGUDA o GRAVE?', audio1:'C5', options:['Aguda','Grave'], correct: 0, explanation: 'Do5 es una nota aguda. Está en el registro alto.', xpVal: 15 },
            { type:'ear-choice', q: 'Si escuchas dos notas, la que vibra MÁS RÁPIDO es...', options:['La más aguda','La más grave','Depende del instrumento'], correct: 0, explanation: 'Mayor frecuencia de vibración = sonido más agudo.', xpVal: 10 },
        ]
    }],
    6: [{
        id: '6.1', title: 'El Pulso Musical', type: 'multi-choice',
        exercises: [
            { type:'choice', q: '¿Qué es el PULSO en música?', options:['El latido constante y regular que organiza la música','El volumen de la música','El tipo de instrumento'], correct: 0, explanation: 'El pulso es como el latido del corazón de la música: constante, regular, inamovible.', xpVal: 10 },
            { type:'choice', q: '¿Qué es el TEMPO?', options:['La velocidad del pulso, medida en BPM','El compás de la música','Una nota larga'], correct: 0, explanation: 'BPM = Beats Per Minute (Pulsos por minuto). A 60 BPM hay un pulso por segundo.', xpVal: 15 },
            { type:'choice', q: 'Un tempo de 60 BPM significa...', options:['1 pulso por segundo','60 pulsos por segundo','1 pulso por minuto'], correct: 0, explanation: '60 BPM = 60 pulsos en 60 segundos = 1 pulso por segundo. ¡Como un reloj!', xpVal: 15 },
            { type:'choice', q: '¿Cómo se llama el aparato que marca el pulso constantemente?', options:['Metrónomo','Afinador','Compressor'], correct: 0, explanation: 'El metrónomo es la herramienta esencial de todo músico para mantener el tempo.', xpVal: 10 },
            { type:'choice', q: 'Un tempo ALLEGRO es...', options:['Rápido (120-156 BPM)','Lento (40-60 BPM)','Moderado (80-120 BPM)'], correct: 0, explanation: 'Allegro significa "alegre, vivo". Andante es moderado. Adagio es lento.', xpVal: 15 },
        ]
    }],
    7: [{
        id: '7.1', title: 'Do Re Mi por Oído', type: 'ear-training',
        exercises: [
            { type:'note-id', q: '¿Cuál de estas notas estás escuchando?', audio:'C4', options:['Do (C)','Re (D)','Mi (E)','Fa (F)'], correct: 0, explanation: 'Esta es la nota DO (C4). Es el centro de la música occidental.', xpVal: 20 },
            { type:'note-id', q: '¿Cuál de estas notas estás escuchando?', audio:'G4', options:['Mi (E)','Fa (F)','Sol (G)','La (A)'], correct: 2, explanation: 'Esta es SOL (G4). Una quinta de Do.', xpVal: 20 },
            { type:'note-id', q: '¿Cuál de estas notas estás escuchando?', audio:'E4', options:['Do (C)','Re (D)','Mi (E)','Sol (G)'], correct: 2, explanation: 'Esta es MI (E4). Tercera mayor de Do.', xpVal: 20 },
            { type:'note-id', q: '¿Cuál de estas notas estás escuchando?', audio:'A4', options:['Sol (G)','La (A)','Si (B)','Do (C)'], correct: 1, explanation: 'Esta es LA (A4) - 440 Hz, el estándar de afinación universal.', xpVal: 20 },
        ]
    }],
    8: [{
        id: '8.1', title: 'Sostenidos y Bemoles', type: 'multi-choice',
        exercises: [
            { type:'choice', q: '¿Qué hace un SOSTENIDO (#) a una nota?', options:['La sube medio tono','La baja medio tono','La duplica en duración'], correct: 0, explanation: 'El sostenido (#) eleva la nota un semitono. Do# es medio tono más alto que Do.', xpVal: 10 },
            { type:'choice', q: '¿Qué hace un BEMOL (b) a una nota?', options:['La baja medio tono','La sube medio tono','La hace sonar más fuerte'], correct: 0, explanation: 'El bemol (b) baja la nota un semitono. Sib es medio tono más bajo que Si.', xpVal: 10 },
            { type:'choice', q: 'Entre qué notas NO hay semitono (tecla negra) en el piano?', options:['Mi-Fa y Si-Do','Do-Re y Re-Mi','Sol-La y La-Si'], correct: 0, explanation: 'Mi-Fa y Si-Do son los únicos pares de notas naturales con solo un semitono de diferencia. Por eso no hay tecla negra entre ellas.', xpVal: 15 },
            { type:'choice', q: 'Do# y Reb son el mismo sonido. Este fenómeno se llama...', options:['Enharmonía','Intervalo','Modulación'], correct: 0, explanation: 'Las notas enharmónicas suenan igual pero se escriben diferente según el contexto tonal.', xpVal: 15 },
            { type:'choice', q: 'La escala cromática tiene ¿cuántas notas?', options:['12','7','5'], correct: 0, explanation: 'La escala cromática incluye todas las notas: 7 naturales + 5 alteradas = 12 semitonos por octava.', xpVal: 15 },
        ]
    }],
    9: [{
        id: '9.1', title: 'Intervalos Básicos', type: 'ear-training',
        exercises: [
            { type:'interval-id', q: 'Escucha este intervalo. ¿Qué tipo es?', notes:['C4','D4'], options:['2da Mayor','3ra Mayor','4ta Justa','Unísono'], correct: 0, explanation: 'Do-Re es una Segunda Mayor (un tono de distancia). Suena a pasos adyacentes.', xpVal: 20 },
            { type:'interval-id', q: 'Escucha este intervalo. ¿Qué tipo es?', notes:['C4','E4'], options:['2da Mayor','3ra Mayor','4ta Justa','5ta Justa'], correct: 1, explanation: 'Do-Mi es una Tercera Mayor (4 semitonos). El intervalo más "alegre".', xpVal: 20 },
            { type:'interval-id', q: 'Escucha este intervalo. ¿Qué tipo es?', notes:['C4','F4'], options:['3ra Mayor','4ta Justa','5ta Justa','Octava'], correct: 1, explanation: 'Do-Fa es una Cuarta Justa (5 semitonos). Suena estable y abierto.', xpVal: 20 },
            { type:'interval-id', q: 'Escucha este intervalo. ¿Qué tipo es?', notes:['C4','G4'], options:['4ta Justa','5ta Justa','6ta Mayor','7ma Mayor'], correct: 1, explanation: 'Do-Sol es una Quinta Justa (7 semitonos). El intervalo más consonante después del Unísono y la Octava.', xpVal: 20 },
            { type:'interval-id', q: 'Escucha este intervalo. ¿Qué tipo es?', notes:['C4','C5'], options:['5ta Justa','7ma Mayor','Octava','6ta Mayor'], correct: 2, explanation: 'Do-Do (una octava arriba) es una Octava. El mismo nombre de nota pero el doble de frecuencia.', xpVal: 20 },
        ]
    }],
    10: [{
        id: '10.1', title: 'Teclado de Piano', type: 'piano-keys',
        exercises: [
            { type:'piano', q: '¡Toca la nota DO en el piano!', targetNote:'C4', hint:'Es la tecla blanca justo antes de las 2 teclas negras', xpVal: 25 },
            { type:'piano', q: '¡Toca la nota SOL!', targetNote:'G4', hint:'Sol está justo después del grupo de 3 teclas negras', xpVal: 25 },
            { type:'piano', q: '¡Toca la nota MI!', targetNote:'E4', hint:'Mi es la tecla blanca después del primer grupo de 2 teclas negras', xpVal: 25 },
            { type:'piano', q: '¡Toca la nota FA!', targetNote:'F4', hint:'Fa está justo antes del grupo de 3 teclas negras', xpVal: 25 },
            { type:'piano', q: '¡Toca DO# (Do Sostenido)!', targetNote:'C#4', hint:'Es la primera tecla negra del grupo de dos', xpVal: 30 },
        ]
    }],
    11: [{
        id: '11.1', title: 'Figuras Rítmicas', type: 'multi-choice',
        exercises: [
            { type:'choice', q: '¿Cuántos tiempos dura una REDONDA?', options:['4','2','1','½'], correct: 0, explanation: 'La Redonda es la figura de mayor duración: 4 tiempos (en compás de 4/4).', xpVal: 10 },
            { type:'choice', q: '¿Cuántos tiempos dura una BLANCA?', options:['2','4','1','½'], correct: 0, explanation: 'La Blanca dura 2 tiempos. Necesitas 2 blancas para completar un compás de 4/4.', xpVal: 10 },
            { type:'choice', q: '¿Cuántos tiempos dura una NEGRA?', options:['1','2','4','½'], correct: 0, explanation: 'La Negra es la unidad básica de pulso: dura exactamente 1 tiempo.', xpVal: 10 },
            { type:'choice', q: '¿Cuántos tiempos dura una CORCHEA?', options:['½','1','2','¼'], correct: 0, explanation: 'La Corchea dura medio tiempo. Caben 2 corcheas en una negra.', xpVal: 10 },
            { type:'choice', q: '¿Cuántas NEGRAS caben en una REDONDA?', options:['4','2','8','1'], correct: 0, explanation: 'Redonda(4) = 4 Negras(1 cada una). La tabla de duración: Redonda→Blanca→Negra→Corchea→Semicorchea.', xpVal: 15 },
            { type:'choice', q: '¿Qué figura rítmica es la más común en la música popular?', options:['La Negra','La Redonda','La Semicorchea'], correct: 0, explanation: 'La Negra es el "pulso" estándar. La mayoría del pop y rock se basa en negras.', xpVal: 10 },
        ]
    }],
    12: [{
        id: '12.1', title: 'Compás 4/4', type: 'multi-choice',
        exercises: [
            { type:'choice', q: 'En el compás 4/4, el número superior (4) indica...', options:['4 pulsos por compás','La nota que vale 4','El tempo'], correct: 0, explanation: 'El numerador indica CUÁNTOS pulsos hay por compás. En 4/4 hay 4 pulsos.', xpVal: 15 },
            { type:'choice', q: 'En el compás 4/4, el número inferior (4) indica...', options:['La negra (♩) es la unidad de pulso','El tempo','Cuántos compases hay'], correct: 0, explanation: 'El denominador indica QUÉ FIGURA vale 1 pulso. El 4 = Negra (¼ de redonda).', xpVal: 15 },
            { type:'choice', q: '¿Cuántas BLANCAS caben en un compás de 4/4?', options:['2','4','1','3'], correct: 0, explanation: 'En 4/4 hay 4 tiempos. Una blanca ocupa 2 tiempos. 4÷2 = 2 blancas.', xpVal: 10 },
            { type:'choice', q: '¿Qué géneros musicales típicamente usan el compás 4/4?', options:['Rock, Pop, Jazz','Vals (3/4)','Polka (2/4)'], correct: 0, explanation: 'El 4/4 es el compás más universal. La mayoría del pop, rock, hip-hop y jazz lo usa.', xpVal: 15 },
        ]
    }],
    21: [{
        id: '21.1', title: 'Escala de Do Mayor', type: 'multi-choice',
        exercises: [
            { type:'choice', q: 'La escala de Do Mayor usa solo teclas...', options:['Blancas (sin alteraciones)','Negras','Mixtas'], correct: 0, explanation: '¡Do Mayor es la única escala mayor sin sostenidos ni bemoles! Solo teclas blancas del piano.', xpVal: 10 },
            { type:'choice', q: 'La estructura de los tonos en una escala mayor es...', options:['T-T-S-T-T-T-S','T-S-T-T-S-T-T','S-T-T-T-S-T-T'], correct: 0, explanation: 'T=Tono, S=Semitono. Esta fórmula (C. Mayor) crea el sonido "alegre" que todos reconocen.', xpVal: 15 },
            { type:'choice', q: '¿Cuántos semitonos hay entre Do y Re?', options:['2 (un tono)','1 (un semitono)','3'], correct: 0, explanation: 'De Do a Re hay 2 semitonos = 1 tono. De Do a Do# hay 1 semitono.', xpVal: 10 },
            { type:'choice', q: '¿Cuántos semitonos hay entre Mi y Fa?', options:['1 (un semitono)','2 (un tono)','3'], correct: 0, explanation: 'Mi-Fa es uno de los dos semitonos naturales. No hay tecla negra entre ellos.', xpVal: 15 },
            { type:'ear-choice', q: 'Escucha la escala de Do Mayor. ¿Cuántas notas tiene?', audio:'scale-C', options:['7 notas (+ octava = 8)','5 notas','12 notas'], correct: 0, explanation: 'Una escala tiene 7 notas distintas plus la octava = 8 notas en total.', xpVal: 15 },
        ]
    }],
    31: [{
        id: '31.1', title: 'Tríadas Mayores', type: 'ear-training',
        exercises: [
            { type:'choice', q: 'Una tríada mayor se construye con...', options:['Fundamental + 3ra Mayor + 5ta Justa','Fundamental + 3ra Menor + 5ta Justa','Fundamental + 4ta Justa + 7ma'], correct: 0, explanation: 'La tríada mayor = F + 3ra Mayor (4 semitonos) + 5ta Justa (7 semitonos). Suena "alegre".', xpVal: 15 },
            { type:'choice', q: '¿Qué notas forman el acorde de DO MAYOR?', options:['Do - Mi - Sol','Do - Mib - Sol','Do - Fa - La'], correct: 0, explanation: 'Do Mayor = Do(F) + Mi(3rdM) + Sol(5thP). El acorde más fundamental de la música occidental.', xpVal: 15 },
            { type:'choice', q: '¿Qué notas forman el acorde de SOL MAYOR?', options:['Sol - Si - Re','Sol - Sib - Re','Sol - La - Mi'], correct: 0, explanation: 'Sol Mayor = Sol + Si (3ra Mayor) + Re (5ta Justa).', xpVal: 15 },
            { type:'interval-id', q: 'Escucha este acorde. ¿Es MAYOR (alegre) o MENOR (melancólico)?', notes:['C4','E4','G4'], options:['Mayor (alegre)','Menor (melancólico)','Disminuido'], correct: 0, explanation: 'Do-Mi-Sol es un acorde Mayor. La 3ra Mayor le da ese carácter brillante.', xpVal: 20 },
            { type:'interval-id', q: 'Escucha este acorde. ¿Es MAYOR o MENOR?', notes:['A3','C4','E4'], options:['Menor (melancólico)','Mayor (alegre)','Aumentado'], correct: 0, explanation: 'La-Do-Mi es La Menor. La 3ra Menor (La→Do) da ese color melancólico.', xpVal: 20 },
        ]
    }],
};

// Add generic fallback lessons for levels not explicitly defined
const GENERIC_LEVEL_POOL = [
    { type:'choice', q: '¿Qué es un intervalo en música?', options:['La distancia entre dos notas','La velocidad de una canción','Un tipo de acorde'], correct: 0, explanation: 'Un intervalo mide la distancia en altura entre dos notas.', xpVal: 10 },
    { type:'choice', q: '¿Cuántos semitonos tiene una octava?', options:['12','7','8','5'], correct: 0, explanation: 'Una octava contiene 12 semitonos (que incluye las 7 notas naturales y 5 alteradas).', xpVal: 10 },
    { type:'choice', q: '¿Qué es una escala pentatónica?', options:['Escala de 5 notas','Escala de 5 compases','Un instrumento de 5 cuerdas'], correct: 0, explanation: 'Penta=5. La escala pentatónica (5 notas) es base del blues y la música asiática.', xpVal: 15 },
    { type:'choice', q: '¿Cuál es la dominante en la tonalidad de Do Mayor?', options:['Sol (G) - 5to grado','Fa (F) - 4to grado','Re (D) - 2do grado'], correct: 0, explanation: 'El V grado siempre es la Dominante. En Do Mayor, el 5to grado es Sol.', xpVal: 15 },
    { type:'choice', q: '¿Qué es el "Círculo de Quintas"?', options:['Sistema que relaciona todas las tonalidades','Un acorde especial','Un ritmo compuesto'], correct: 0, explanation: 'El Círculo de Quintas organiza las 12 tonalidades por relación de 5tas y es esencial en armonía.', xpVal: 20 },
    { type:'choice', q: '¿Qué es un acorde disminuido?', options:['Dos terceras menores apiladas','Tercera mayor + quinta justa','Cuarta + quinta justa'], correct: 0, explanation: 'El acorde disminuido tiene una sonoridad tensa e inestable: dos terceras menores.', xpVal: 15 },
    { type:'choice', q: 'El modo Dórico es...', options:['Escala menor con 6ta mayor','Escala mayor con 4ta aumentada','Escala menor con 7ma mayor'], correct: 0, explanation: 'El Dórico es la escala del jazz y rock: como la menor natural pero con un 6to grado mayor brillante.', xpVal: 20 },
];

// Fill in generic lessons for levels 13-20, 22-30, 32-50 (not explicitly defined)
Array.from({length: 50}, (_, i) => i + 1)
    .filter(n => !LESSONS_DB[n])
    .forEach(n => {
        const start = (n * 3) % GENERIC_LEVEL_POOL.length;
        const exercises = [
            ...GENERIC_LEVEL_POOL.slice(start),
            ...GENERIC_LEVEL_POOL.slice(0, start)
        ].slice(0, 4).map(e => ({ ...e }));
        LESSONS_DB[n] = [{
            id: `${n}.1`,
            title: LEVEL_META[n]?.title || `Nivel ${n}`,
            type: 'multi-choice',
            exercises,
        }];
    });
