/**
 * academyFeedback.js — Zion Academy v2.0
 * Mensajes de feedback en español, variados y motivadores
 */

const successMessages = [
    "¡Perfecto! Tu oído musical está mejorando increíblemente.",
    "¡Correcto! Esa concentración es exactamente lo que hace a un músico.",
    "¡Excelente! Cada respuesta correcta construye tu oído musical.",
    "¡Brillante! La teoría musical se está convirtiendo en segunda naturaleza para ti.",
    "¡Correcto! Los grandes músicos también empezaron así.",
    "¡Muy bien! Tu precisión está mejorando con cada ejercicio.",
    "¡Exacto! Eso es el oído de un músico en entrenamiento.",
    "¡Impresionante reflexión musical!",
    "¡Sí! La práctica constante lleva a la maestría.",
    "¡Correcto! Beethoven estaría orgulloso.",
];

const errorMessages = [
    "Casi. Escucha otra vez con más atención — tu oído aprende con cada intento.",
    "No exactamente, pero el error es parte del aprendizaje musical. ¡Sigue!",
    "Incorrecto esta vez. Lee la explicación y te quedará claro.",
    "No te preocupes. Hasta los músicos profesionales se equivocan.",
    "Sigue intentando. La repetición es la madre de la habilidad musical.",
    "Incorrecto, pero ¡ya casi lo tienes! La música requiere paciencia.",
];

const earTrainingMessages = [
    "En el entrenamiento auditivo, tu cerebro necesita tiempo para crear conexiones nuevas. ¡No te rindas!",
    "Reconocer notas por oído es como entrenar un músculo — mejora con la práctica diaria.",
    "Los cantantes y músicos de jazz llaman a esto 'oído relativo'. Se desarrolla con el tiempo.",
];

export const getRandomSuccess = () => successMessages[Math.floor(Math.random() * successMessages.length)];
export const getRandomError   = () => errorMessages[Math.floor(Math.random() * errorMessages.length)];
export const getEarMessage    = () => earTrainingMessages[Math.floor(Math.random() * earTrainingMessages.length)];

export const levelFinishQuotes = {
    beginner: "¡Fundamentos completados! Has construido las bases de tu vida musical.",
    intermediate: "¡Nivel intermedio superado! Tu comprensión teórica está avanzando seriamente.",
    expert: "¡Nivel experto alcanzado! Tu dominio de la armonía compleja es impresionante.",
};

export const MUSICAL_TIPS = [
    "💡 Practica 15 minutos diarios en lugar de 2 horas una vez a la semana.",
    "🎵 Canta las notas al estudiarlas — el canto fija las alturas en tu memoria.",
    "🎹 En el piano, el DO siempre está antes de las 2 teclas negras agrupadas.",
    "👂 El entrenamiento auditivo mejora tu capacidad de improvisar y tocar de oído.",
    "🎸 Las progresiones I-IV-V son la base del 60% de la música popular.",
    "🥁 Mantén el metrónomo encendido aunque vayas lento — la precisión es clave.",
    "📖 El Círculo de Quintas es el mapa de todas las tonalidades — ¡apréndelo!",
    "🎼 Bach escribía música mientras desayunaba. La práctica hace al maestro.",
];

export const getRandomTip = () => MUSICAL_TIPS[Math.floor(Math.random() * MUSICAL_TIPS.length)];
