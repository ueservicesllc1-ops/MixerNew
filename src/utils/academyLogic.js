export const placementQuiz = [
  {
    id: 'q1',
    question: '¿Cuál es el orden de las notas musicales en sentido ascendente?',
    options: [
      { text: 'Do, Re, Mi, Fa, Sol, La, Si', score: 2, level: 'initial' },
      { text: 'Do, Mi, Sol, Si, Re, Fa, La', score: 0, level: 'initial' },
      { text: 'La, Si, Do, Re, Mi, Fa, Sol', score: 3, level: 'medium' }
    ]
  },
  {
    id: 'q2',
    question: '¿Qué es el pulso en la música?',
    options: [
      { text: 'La velocidad de la canción', score: 1, level: 'initial' },
      { text: 'El latido constante y regular', score: 2, level: 'initial' },
      { text: 'La intensidad del volumen', score: 0, level: 'initial' }
    ]
  },
  {
    id: 'q3',
    question: '¿Cuántas líneas tiene un pentagrama estándar?',
    options: [
      { text: '4 líneas', score: 0, level: 'initial' },
      { text: '5 líneas', score: 2, level: 'initial' },
      { text: '6 líneas', score: 1, level: 'initial' }
    ]
  },
  {
    id: 'q4',
    question: '¿Qué intervalo hay entre Do y Mi?',
    options: [
      { text: 'Una segunda', score: 0, level: 'initial' },
      { text: 'Una tercera mayor', score: 5, level: 'medium' },
      { text: 'Una cuarta justa', score: 1, level: 'initial' }
    ]
  },
  {
    id: 'q5',
    question: '¿Cuál de estos acordes es una tríada menor?',
    options: [
      { text: 'Do - Mi - Sol', score: 1, level: 'initial' },
      { text: 'La - Do - Mi', score: 5, level: 'medium' },
      { text: 'Re - Fa# - La', score: 2, level: 'initial' }
    ]
  },
  {
    id: 'q6',
    question: '¿Qué significa la indicación de compás 4/4?',
    options: [
      { text: 'Cuatro notas por canción', score: 0, level: 'initial' },
      { text: 'Cuatro pulsos de negra por compás', score: 6, level: 'medium' },
      { text: 'Cuatro instrumentos tocando a la vez', score: 0, level: 'initial' }
    ]
  },
  {
    id: 'q7',
    question: '¿Qué es una cadencia perfecta en armonía?',
    options: [
      { text: 'Cuando el cantante no desafina', score: 0, level: 'expert' },
      { text: 'La progresión del V al I grado', score: 10, level: 'expert' },
      { text: 'Un ritmo muy rápido', score: 1, level: 'medium' }
    ]
  }
];

export const academyCurriculum = {
  initial: [
    {
      id: 'init-1',
      title: '1. El Alfabeto Musical',
      description: 'Dominando las 7 notas naturales.',
      icon: '🎹',
      exercises: [
        {
          question: '¿Qué nota está inmediatamente antes de DO?',
          options: ['SI', 'LA', 'RE', 'SOL'],
          correct: 0,
          explanation: 'La escala es circular: ...La, Si, DO, Re...'
        },
        {
          question: '¿Cuál es la nota que está entre MI y SOL?',
          options: ['FA', 'RE', 'LA', 'DO'],
          correct: 0,
          explanation: 'Do, Re, Mi, FA, Sol.'
        },
        {
          question: '¿Qué nota está dos pasos arriba de LA?',
          options: ['DO', 'SI', 'SOL', 'RE'],
          correct: 0,
          explanation: 'La -> Si (1) -> DO (2).'
        },
        {
          question: 'Si bajamos una nota desde FA, llegamos a...',
          options: ['MI', 'SOL', 'RE', 'DO'],
          correct: 0,
          explanation: 'En sentido descendente: Sol, Fa, MI.'
        },
        {
          question: '¿Cuál es la nota más aguda de estas tres?',
          options: ['RE', 'LA', 'MI'],
          correct: 1,
          explanation: 'Siguiendo el orden ascendente Do-Re-Mi-Fa-Sol-LA es la más alta.'
        }
      ]
    },
    {
      id: 'init-2',
      title: '2. El Pulso y la Negra',
      description: 'Sintiendo el latido de la música.',
      icon: '⏱️',
      exercises: [
        {
          question: 'La figura musical que dura un pulso se llama...',
          options: ['Negra', 'Blanca', 'Redonda', 'Corchea'],
          correct: 0,
          explanation: 'La Negra es nuestra unidad básica de medida (1 pulso).'
        },
        {
          question: '¿Cuántos pulsos dura una Blanca?',
          options: ['2 pulsos', '4 pulsos', '1 pulso', '3 pulsos'],
          correct: 0,
          explanation: 'La Blanca dura el doble que una negra: 2 pulsos.'
        },
        {
          question: 'Si en un compás hay 4 negras, ¿qué figura podría reemplazarlas a todas?',
          options: ['Una Redonda', 'Dos Blancas', 'Ambas son correctas'],
          correct: 2,
          explanation: 'Una Redonda dura 4 y dos Blancas duran 2+2=4.'
        },
        {
          question: '¿Qué es el tempo en la música?',
          options: ['La velocidad del pulso', 'El volumen', 'El tipo de instrumento'],
          correct: 0,
          explanation: 'El tempo indica qué tan rápido o lento es el latido musical.'
        }
      ]
    },
    {
      id: 'init-3',
      title: '3. Clave de Sol',
      description: 'Aprendiendo a leer en el pentagrama.',
      icon: '🎼',
      exercises: [
        {
          question: 'La Clave de Sol empieza a dibujarse en la...',
          options: ['Segunda línea', 'Primera línea', 'Tercera línea'],
          correct: 0,
          explanation: 'Por eso la nota que está en la segunda línea se llama SOL.'
        },
        {
          question: '¿Qué nota se escribe en el primer espacio del pentagrama?',
          options: ['FA', 'MI', 'SOL', 'LA'],
          correct: 0,
          explanation: 'Línea 1 es Mi, Espacio 1 es FA.'
        },
        {
          question: 'La nota que tiene una línea pequeña atravesada debajo del pentagrama es...',
          options: ['DO', 'RE', 'SI', 'LA'],
          correct: 0,
          explanation: 'Es el Do Central.'
        }
      ]
    },
    {
      id: 'init-4',
      title: '4. Alteraciones: Sostenidos',
      description: 'Las notas que están en el medio.',
      icon: '♯',
      exercises: [
        {
          question: '¿Qué hace un Sostenido (#) a una nota?',
          options: ['Sube medio tono', 'Baja medio tono', 'Mantiene la nota igual'],
          correct: 0,
          explanation: 'El sostenido eleva la altura de la nota en un semitono.'
        },
        {
          question: '¿Entre qué notas NO hay una tecla negra (sostenido) en el piano?',
          options: ['Mi-Fa y Si-Do', 'Do-Re y Fa-Sol', 'La-Si y Re-Mi'],
          correct: 0,
          explanation: 'Estas notas están a medio tono de distancia natural.'
        }
      ]
    }
  ],
  medium: [
    {
      id: 'mid-1',
      title: '1. Escalas Mayores Avanzadas',
      description: 'Tonos, semitonos y el Círculo de Quintas.',
      icon: '🪜',
      exercises: [
        {
          question: '¿Cuál es la estructura de una Escala Mayor?',
          options: ['T-T-S-T-T-T-S', 'T-S-T-T-S-T-T', 'T-T-T-S-T-T-S'],
          correct: 0,
          explanation: 'Tono-Tono-Semitono-Tono-Tono-Tono-Semitono.'
        },
        {
          question: '¿Cuántos sostenidos tiene la escala de RE Mayor?',
          options: ['2 (Fa# y Do#)', '1 (Fa#)', '3 (Fa#, Do#, Sol#)'],
          correct: 0,
          explanation: 'Re-Mi-Fa#-Sol-La-Si-Do#-Re.'
        },
        {
          question: 'Si una escala tiene un SIB (Si Bemol), ¿en qué tonalidad estamos?',
          options: ['FA Mayor', 'SOL Mayor', 'DO Mayor'],
          correct: 0,
          explanation: 'La escala de Fa Mayor tiene el Si bemol como alteración fija.'
        },
        {
          question: '¿Qué nota es la Quinta Justa de SOL?',
          options: ['RE', 'DO', 'MI', 'LA'],
          correct: 0,
          explanation: 'Sol-La-Si-Do-RE.'
        },
        {
          question: '¿Cuál es el orden de los sostenidos en la armadura?',
          options: ['Fa-Do-Sol-Re-La-Mi-Si', 'Do-Sol-Re-La-Mi-Si-Fa', 'Si-Mi-La-Re-Sol-Do-Fa'],
          correct: 0,
          explanation: 'Se conoce como el orden de quintas: Fa, Do, Sol, Re, La, Mi, Si.'
        }
      ]
    },
    {
      id: 'mid-2',
      title: '2. Tríadas e Inversiones',
      description: 'La base de todos los acordes.',
      icon: '🎸',
      exercises: [
        {
          question: '¿De qué se compone una Tríada Mayor?',
          options: ['Fundamental, 3ra Mayor y 5ta Justa', 'Fundamental, 3ra Menor y 5ta Justa', 'Fundamental, 3ra Mayor y 5ta Aumentada'],
          correct: 0,
          explanation: 'La 3ra Mayor da el carácter "alegre" y la 5ta la estabilidad.'
        },
        {
          question: '¿Qué notas forman el acorde de LA Menor?',
          options: ['La - Do - Mi', 'La - Do# - Mi', 'La - Re - Mi'],
          correct: 0,
          explanation: 'La-Do es una tercera menor (3 semitonos).'
        },
        {
          question: 'Si pongo la nota MI en el bajo de un acorde de DO Mayor, ¿qué inversión es?',
          options: ['Primera Inversión (6/3)', 'Segunda Inversión (6/4)', 'Posición Fundamental'],
          correct: 0,
          explanation: 'La primera inversión es cuando la tercera está en el bajo.'
        },
        {
          question: 'Un acorde disminuido se forma por...',
          options: ['Dos terceras menores', 'Una tercera mayor y una menor', 'Dos terceras mayores'],
          correct: 0,
          explanation: 'Ejemplo: Si - Re (3m) y Re - Fa (3m).'
        }
      ]
    },
    {
      id: 'mid-3',
      title: '3. Compases y Subdivisiones',
      description: 'Corcheas, semicorcheas y síncopas.',
      icon: '🥁',
      exercises: [
        {
          question: '¿Cuántas semicorcheas caben en una Negra?',
          options: ['4', '2', '8', '16'],
          correct: 0,
          explanation: 'Cada negra se divide en 2 corcheas y cada corchea en 2 semicorcheas.'
        },
        {
          question: 'En un compás de 6/8, ¿cuál es la figura que marca el pulso?',
          options: ['La Negra con puntillo', 'La Negra', 'La Corchea'],
          correct: 0,
          explanation: 'El 6/8 es un compás compuesto donde el pulso es ternario.'
        },
        {
          question: '¿Qué hace el "Puntillo" a una nota?',
          options: ['Le añade la mitad de su valor', 'Le quita la mitad', 'Le suma un pulso exacto'],
          correct: 0,
          explanation: 'Una blanca (2) con puntillo dura 3 (2 + 1).'
        }
      ]
    }
  ],
  expert: [
    {
      id: 'exp-1',
      title: '1. Modos Griegos Profundos',
      description: 'Domina los 7 colores de la escala.',
      icon: '🏛️',
      exercises: [
        {
          question: '¿Cuál es la nota característica del modo Dórico?',
          options: ['La 6ta Mayor', 'La 2da Menor', 'La 4ta Aumentada'],
          correct: 0,
          explanation: 'El modo dórico es menor pero con una sexta mayor brillante.'
        },
        {
          question: '¿Qué modo se utiliza comúnmente sobre un acorde dominante (V7)?',
          options: ['Mixolidio', 'Lidio', 'Locrio'],
          correct: 0,
          explanation: 'El Mixolidio tiene la 7ma menor necesaria para el acorde dominante.'
        }
      ]
    },
    {
      id: 'exp-2',
      title: '2. Armonía Funcional',
      description: 'Tensión, Reposo y Movimiento.',
      icon: '🎼',
      exercises: [
        {
          question: 'En la tonalidad de DO, ¿cuál es el acorde de Dominante?',
          options: ['SOL 7', 'FA Maj7', 'RE m7'],
          correct: 0,
          explanation: 'El quinto grado (V) siempre tiene función de dominante.'
        },
        {
          question: '¿Qué es el Tritono?',
          options: ['Un intervalo de 3 tonos (4ta Aumentada)', 'Un acorde de 3 notas', 'Un ritmo de 3 pulsos'],
          correct: 0,
          explanation: 'Es el intervalo con más tensión en la música occidental.'
        }
      ]
    }
  ]
};
