import type { ReactNode } from 'react';

export type ThemeId =
  | 'pirati'
  | 'unicorni'
  | 'draghi'
  | 'spazio'
  | 'dinosauri'
  | 'principessa';

export interface BookTheme {
  id: ThemeId;
  name: string;
  description: string;
  sampleScene: string;
  renderIllustration: (className?: string) => ReactNode;
}

export const BOOK_THEMES: readonly BookTheme[] = [
  {
    id: 'pirati',
    name: 'Pirati',
    description: 'Velieri tra le onde, bussole antiche e isole del tesoro.',
    sampleScene: 'Capitano sul ponte del veliero',
    renderIllustration: (className = 'w-full h-full') => (
      <svg
        viewBox="0 0 180 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="180" height="130" fill="#FFFFFF" />
        {/* Clouds */}
        <path
          d="M24 30C24 25 28 22 33 22C35 17 42 16 46 20C50 18 55 21 55 26C58 27 59 31 56 34H26C23 34 22 31 24 30Z"
          stroke="#18181B"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M126 26C126 22 130 19 134 20C136 16 142 15 145 19C149 18 153 21 153 25C156 26 156 30 153 31H128C125 31 124 28 126 26Z"
          stroke="#18181B"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Ship Hull */}
        <path
          d="M42 84H136L124 104H54L42 84Z"
          stroke="#18181B"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <line x1="56" y1="93" x2="122" y2="93" stroke="#18181B" strokeWidth="1.8" />
        <circle cx="72" cy="98" r="2.8" stroke="#18181B" strokeWidth="1.8" />
        <circle cx="90" cy="98" r="2.8" stroke="#18181B" strokeWidth="1.8" />
        <circle cx="108" cy="98" r="2.8" stroke="#18181B" strokeWidth="1.8" />
        {/* Mast & Sails */}
        <line x1="90" y1="24" x2="90" y2="84" stroke="#18181B" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M90 32C108 38 118 52 118 74H90V32Z"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M86 38C72 44 64 56 64 74H86V38Z"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Flag */}
        <path d="M90 24L108 28L90 32V24Z" stroke="#18181B" strokeWidth="2" strokeLinejoin="round" />
        {/* Waves */}
        <path
          d="M14 112C24 106 34 116 44 112C54 106 64 116 74 112C84 106 94 116 104 112C114 106 124 116 134 112C144 106 154 116 166 112"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'unicorni',
    name: 'Unicorni',
    description: 'Radure incantate, arcobaleni e sentieri tra le nuvole.',
    sampleScene: 'Passeggiata sotto l’arcobaleno',
    renderIllustration: (className = 'w-full h-full') => (
      <svg
        viewBox="0 0 180 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="180" height="130" fill="#FFFFFF" />
        {/* Rainbow */}
        <path d="M26 92C26 52 55 24 90 24C125 24 154 52 154 92" stroke="#18181B" strokeWidth="2" />
        <path d="M36 92C36 58 60 34 90 34C120 34 144 58 144 92" stroke="#18181B" strokeWidth="2" />
        <path d="M46 92C46 64 66 44 90 44C114 44 134 64 134 92" stroke="#18181B" strokeWidth="2" />
        {/* Unicorn silhouette line art */}
        <path
          d="M72 98V80C72 72 78 66 86 66H98C105 66 111 71 112 78L114 98"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M74 68L66 50C66 46 70 43 76 44L85 48L82 66"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Horn */}
        <path d="M74 44L68 28L79 44" stroke="#18181B" strokeWidth="2" strokeLinejoin="round" />
        {/* Mane */}
        <path
          d="M84 48C89 49 91 55 87 58C92 60 92 65 88 67"
          stroke="#18181B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Stars */}
        <path
          d="M35 30L37 35L42 37L37 39L35 44L33 39L28 37L33 35L35 30Z"
          stroke="#18181B"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M144 34L146 38L150 40L146 42L144 46L142 42L138 40L142 38L144 34Z"
          stroke="#18181B"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Soft clouds base */}
        <path
          d="M20 100C20 94 26 90 32 92C36 86 46 86 50 93C55 91 61 95 60 101H22C20 101 20 100 20 100Z"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2"
        />
        <path
          d="M118 100C118 94 124 90 130 92C134 86 144 86 148 93C153 91 159 95 158 101H120C118 101 118 100 118 100Z"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: 'draghi',
    name: 'Draghi',
    description: 'Valli rocciose, draghi gentili e castelli tra le vette.',
    sampleScene: 'In volo con un drago amico',
    renderIllustration: (className = 'w-full h-full') => (
      <svg
        viewBox="0 0 180 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="180" height="130" fill="#FFFFFF" />
        {/* Mountains */}
        <path d="M16 106L50 56L80 106" stroke="#18181B" strokeWidth="2" strokeLinejoin="round" />
        <path d="M104 106L134 62L166 106" stroke="#18181B" strokeWidth="2" strokeLinejoin="round" />
        {/* Friendly Dragon */}
        <path
          d="M58 84C58 70 72 62 88 64C102 66 112 74 114 88C115 95 110 102 102 102H72C63 102 58 94 58 84Z"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2.3"
        />
        {/* Dragon Head */}
        <path
          d="M108 72L126 64C131 62 135 66 133 72C131 76 124 79 116 79"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="123" cy="69" r="1.8" fill="#18181B" />
        {/* Dragon Wings */}
        <path
          d="M84 64C78 44 64 34 52 38C56 48 64 56 76 66"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M92 64C98 42 112 32 124 38C118 48 110 56 100 66"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Tail */}
        <path
          d="M58 88C44 90 36 82 32 74L38 71L30 66"
          stroke="#18181B"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'spazio',
    name: 'Spazio',
    description: 'Razzi, pianeti ad anelli e passeggiate sulla luna.',
    sampleScene: 'Esploratore tra stelle e pianeti',
    renderIllustration: (className = 'w-full h-full') => (
      <svg
        viewBox="0 0 180 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="180" height="130" fill="#FFFFFF" />
        {/* Saturn Planet */}
        <circle cx="134" cy="40" r="14" stroke="#18181B" strokeWidth="2.2" />
        <ellipse
          cx="134"
          cy="40"
          rx="25"
          ry="6"
          transform="rotate(-18 134 40)"
          stroke="#18181B"
          strokeWidth="2"
        />
        {/* Moon */}
        <circle cx="38" cy="36" r="11" stroke="#18181B" strokeWidth="2" />
        <circle cx="35" cy="33" r="2.2" stroke="#18181B" strokeWidth="1.6" />
        <circle cx="42" cy="40" r="1.8" stroke="#18181B" strokeWidth="1.6" />
        {/* Rocket */}
        <path
          d="M90 26C101 38 106 56 104 78H76C74 56 79 38 90 26Z"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        <circle cx="90" cy="54" r="8" stroke="#18181B" strokeWidth="2.2" />
        <path d="M76 68L64 82H76" stroke="#18181B" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M104 68L116 82H104" stroke="#18181B" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M84 78L90 96L96 78" stroke="#18181B" strokeWidth="2.2" strokeLinejoin="round" />
        {/* Stars */}
        <circle cx="56" cy="96" r="2" fill="#18181B" />
        <circle cx="128" cy="88" r="2" fill="#18181B" />
        <path
          d="M36 74L38 78L42 80L38 82L36 86L34 82L30 80L34 78L36 74Z"
          stroke="#18181B"
          strokeWidth="1.6"
        />
        <path
          d="M148 96L150 100L154 102L150 104L148 108L146 104L142 102L146 100L148 96Z"
          stroke="#18181B"
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
  {
    id: 'dinosauri',
    name: 'Dinosauri',
    description: 'Felci giganti, colline preistoriche e dinosauri amichevoli.',
    sampleScene: 'Avventura nella valle preistorica',
    renderIllustration: (className = 'w-full h-full') => (
      <svg
        viewBox="0 0 180 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="180" height="130" fill="#FFFFFF" />
        {/* Volcano */}
        <path d="M114 96L134 52H148L166 96" stroke="#18181B" strokeWidth="2" strokeLinejoin="round" />
        <path
          d="M132 42C132 37 138 35 142 38C146 35 151 38 150 43"
          stroke="#18181B"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* Brontosaurus */}
        <path
          d="M42 96V80C42 66 56 58 72 60C80 61 85 52 87 38C88 30 94 26 102 27C107 28 110 32 108 36C106 40 99 40 96 44C93 52 94 64 96 74V96H86V82H64V96H54V82H48"
          fill="#FFFFFF"
          stroke="#18181B"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M42 82C32 82 24 76 22 68" stroke="#18181B" strokeWidth="2.3" strokeLinecap="round" />
        <circle cx="101" cy="32" r="1.8" fill="#18181B" />
        {/* Ferns / ground */}
        <line x1="16" y1="102" x2="164" y2="102" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 102C26 94 31 89 36 88" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M26 102C22 95 19 91 16 90" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'principessa',
    name: 'Principessa',
    description: 'Giardini fioriti, torri fiabesche e carrozze reali.',
    sampleScene: 'Nel giardino del castello incantato',
    renderIllustration: (className = 'w-full h-full') => (
      <svg
        viewBox="0 0 180 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="180" height="130" fill="#FFFFFF" />
        {/* Fairy Castle */}
        <rect x="64" y="56" width="52" height="46" stroke="#18181B" strokeWidth="2.2" />
        <rect x="44" y="68" width="20" height="34" stroke="#18181B" strokeWidth="2" />
        <rect x="116" y="68" width="20" height="34" stroke="#18181B" strokeWidth="2" />
        {/* Roofs */}
        <path d="M60 56L90 26L120 56H60Z" stroke="#18181B" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M40 68L54 44L64 68H40Z" stroke="#18181B" strokeWidth="2" strokeLinejoin="round" />
        <path d="M116 68L126 44L140 68H116Z" stroke="#18181B" strokeWidth="2" strokeLinejoin="round" />
        {/* Gate */}
        <path d="M81 102V84C81 79 85 75 90 75C95 75 99 79 99 84V102" stroke="#18181B" strokeWidth="2.2" />
        {/* Crown emblem */}
        <path
          d="M82 50L84 42L90 47L96 42L98 50H82Z"
          stroke="#18181B"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Flowers / Bushes */}
        <path
          d="M20 102C22 94 30 92 36 96C38 92 43 92 44 96"
          stroke="#18181B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M136 96C138 92 143 92 145 96C151 92 158 94 160 102"
          stroke="#18181B"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];
