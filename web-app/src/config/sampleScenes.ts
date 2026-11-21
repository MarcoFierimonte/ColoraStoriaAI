import type { ThemeId } from '../data/themes';

const LOGICAL_WIDTH = 560;
const LOGICAL_HEIGHT = 792;
// Render at 2x (1120x1584) so BrowserPhotoValidator accepts samples without low-resolution warnings.
const RENDER_SCALE = 2;

export interface SampleSceneDefinition {
  id: string;
  label: string;
  category: string;
  suggestedThemeId: ThemeId;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  color: string,
  points: readonly number[]
) {
  if (points.length < 4) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  ctx.closePath();
  ctx.fill();
}

function drawBackground(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

export const SAMPLE_SCENES: readonly SampleSceneDefinition[] = [
  {
    id: 'gatto',
    label: 'Gatto',
    category: 'Animali',
    suggestedThemeId: 'unicorni',
    draw: (ctx) => {
      drawBackground(ctx, '#cfe8ff');
      drawEllipse(ctx, 280, 640, 170, 190, '#f2a24a');
      drawPolygon(ctx, '#f2a24a', [140, 270, 165, 110, 270, 200]);
      drawPolygon(ctx, '#f2a24a', [420, 270, 395, 110, 290, 200]);
      drawCircle(ctx, 280, 330, 150, '#f2a24a');
      drawRect(ctx, '#c9742a', 262, 185, 16, 60);
      drawRect(ctx, '#c9742a', 225, 195, 14, 45);
      drawRect(ctx, '#c9742a', 317, 195, 14, 45);
      drawCircle(ctx, 225, 310, 32, '#fff');
      drawCircle(ctx, 335, 310, 32, '#fff');
      drawCircle(ctx, 225, 314, 15, '#222');
      drawCircle(ctx, 335, 314, 15, '#222');
      drawEllipse(ctx, 280, 405, 62, 44, '#fff3e0');
      drawPolygon(ctx, '#ff8fb0', [258, 378, 302, 378, 280, 402]);

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 4;
      const whiskers: ReadonlyArray<[number, number, number, number]> = [
        [200, 400, 70, 380],
        [200, 415, 70, 430],
        [360, 400, 490, 380],
        [360, 415, 490, 430],
      ];
      for (const [x1, y1, x2, y2] of whiskers) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    },
  },
  {
    id: 'orsetto',
    label: 'Orsetto',
    category: 'Giocattoli',
    suggestedThemeId: 'pirati',
    draw: (ctx) => {
      drawBackground(ctx, '#ffe3ee');
      drawCircle(ctx, 170, 210, 52, '#a8672f');
      drawCircle(ctx, 390, 210, 52, '#a8672f');
      drawCircle(ctx, 170, 210, 26, '#e7b98a');
      drawCircle(ctx, 390, 210, 26, '#e7b98a');
      drawEllipse(ctx, 135, 610, 42, 88, '#a8672f');
      drawEllipse(ctx, 425, 610, 42, 88, '#a8672f');
      drawEllipse(ctx, 280, 640, 150, 170, '#a8672f');
      drawEllipse(ctx, 280, 655, 95, 110, '#e7b98a');
      drawCircle(ctx, 280, 340, 135, '#a8672f');
      drawEllipse(ctx, 280, 395, 62, 48, '#e7b98a');
      drawCircle(ctx, 235, 320, 14, '#222');
      drawCircle(ctx, 325, 320, 14, '#222');
      drawEllipse(ctx, 280, 378, 22, 14, '#222');
      drawPolygon(ctx, '#e04b4b', [280, 505, 210, 470, 210, 540]);
      drawPolygon(ctx, '#e04b4b', [280, 505, 350, 470, 350, 540]);
    },
  },
  {
    id: 'paesaggio',
    label: 'Paesaggio',
    category: 'Paesaggi',
    suggestedThemeId: 'draghi',
    draw: (ctx) => {
      const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT * 0.6);
      sky.addColorStop(0, '#8fcfff');
      sky.addColorStop(1, '#d9f0ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      drawCircle(ctx, 440, 150, 64, '#ffcf3d');
      drawEllipse(ctx, 200, 640, 420, 200, '#5fb85a');
      drawRect(ctx, '#f3e2c4', 150, 380, 240, 190);
      drawPolygon(ctx, '#d1543b', [125, 385, 270, 270, 415, 385]);
      drawRect(ctx, '#7a4a2b', 245, 470, 52, 100);
      drawRect(ctx, '#8fcfff', 176, 420, 48, 48);
      drawRect(ctx, '#8fcfff', 320, 420, 48, 48);
      drawCircle(ctx, 90, 230, 38, '#fff');
      drawCircle(ctx, 130, 226, 30, '#fff');
      drawCircle(ctx, 300, 120, 34, '#fff');
    },
  },
  {
    id: 'ritratto',
    label: 'Ritratto',
    category: 'Persone',
    suggestedThemeId: 'principessa',
    draw: (ctx) => {
      drawBackground(ctx, '#dff5d6');
      drawEllipse(ctx, 280, 770, 240, 160, '#4d8ef0');
      drawRect(ctx, '#f0c29a', 250, 380, 60, 90);
      drawCircle(ctx, 280, 300, 105, '#f0c29a');

      ctx.fillStyle = '#5a3a22';
      ctx.beginPath();
      ctx.arc(280, 290, 114, Math.PI, 0);
      ctx.fill();
      drawEllipse(ctx, 230, 205, 60, 30, '#5a3a22');

      drawCircle(ctx, 245, 315, 11, '#222');
      drawCircle(ctx, 315, 315, 11, '#222');
      drawCircle(ctx, 220, 345, 14, '#ff9fb5');
      drawCircle(ctx, 340, 345, 14, '#ff9fb5');

      ctx.strokeStyle = '#222';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(280, 340, 40, 0.25, Math.PI - 0.25);
      ctx.stroke();
    },
  },
];

export async function renderSampleSceneToFile(
  sceneId: string
): Promise<{ file: File; scene: SampleSceneDefinition }> {
  const scene = SAMPLE_SCENES.find((item) => item.id === sceneId);
  if (!scene) {
    throw new Error(`Esempio "${sceneId}" non trovato.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = LOGICAL_WIDTH * RENDER_SCALE;
  canvas.height = LOGICAL_HEIGHT * RENDER_SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossibile inizializzare l’anteprima dell’esempio.');
  }

  ctx.save();
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  scene.draw(ctx);
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (generated) => {
        if (!generated) {
          reject(new Error('Errore nella creazione del file di esempio.'));
          return;
        }
        resolve(generated);
      },
      'image/png',
      0.95
    );
  });

  const file = new File([blob], `esempio-${scene.id}.png`, { type: 'image/png' });
  return { file, scene };
}
