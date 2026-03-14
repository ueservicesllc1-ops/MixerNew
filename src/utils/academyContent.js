export const academyLevels = [
  {
    id: 'fundamentals-1',
    title: 'Nivel 1: El Pulso',
    description: 'Aprende a sentir el latido de la música.',
    lessons: [
      {
        id: 'pulse-intro',
        type: 'theory',
        title: '¿Qué es el pulso?',
        content: 'El pulso es la unidad básica de tiempo en la música. Es como el latido del corazón.'
      },
      {
        id: 'pulse-match',
        type: 'rhythm',
        title: 'Sigue el pulso',
        targetBPM: 100,
        requiredHits: 8
      }
    ]
  },
  {
    id: 'pitch-1',
    title: 'Nivel 2: Alturas',
    description: 'Diferencia entre sonidos agudos y graves.',
    lessons: [
      {
        id: 'pitch-comp',
        type: 'ear-training',
        title: 'Agudo vs Grave',
        exercises: [
          { question: '¿Cuál nota es más aguda?', options: ['A', 'B'], correct: 0, audioA: 'high_c.mp3', audioB: 'low_c.mp3' }
        ]
      }
    ]
  }
];
