import React, { useMemo } from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
}

/**
 * Детерминированный монохромный QR-модуль для чистого предпросмотра ссылок /sub и ключей.
 * В проде при желании можно заменить на библиотеку `qrcode` для полного сканирования камерой.
 */
export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({ value, size = 188 }) => {
  const grid = useMemo(() => {
    const dim = 25;
    const matrix: boolean[][] = Array.from({ length: dim }, () =>
      Array(dim).fill(false)
    );

    const drawFinder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const border = x === 0 || y === 0 || x === 6 || y === 6;
          const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          matrix[oy + y][ox + x] = border || center;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(dim - 7, 0);
    drawFinder(0, dim - 7);

    // Alignment pattern
    for (let y = 16; y <= 20; y++) {
      for (let x = 16; x <= 20; x++) {
        const edge = x === 16 || y === 16 || x === 20 || y === 20;
        const mid = x === 18 && y === 18;
        matrix[y][x] = edge || mid;
      }
    }

    // Детерминированное заполнение данных на базе хэша строки
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const isReserved = (x: number, y: number) => {
      if (x < 8 && y < 8) return true;
      if (x >= dim - 8 && y < 8) return true;
      if (x < 8 && y >= dim - 8) return true;
      if (x >= 16 && x <= 20 && y >= 16 && y <= 20) return true;
      return false;
    };

    let seed = hash >>> 0;
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        if (isReserved(x, y)) continue;
        if (x === 6 || y === 6) {
          matrix[y][x] = (x + y) % 2 === 0;
          continue;
        }
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        matrix[y][x] = (seed & 1) === 1;
      }
    }

    return { dim, matrix };
  }, [value]);

  const cell = size / (grid.dim + 2);

  return (
    <div className="inline-flex items-center justify-center rounded-[22px] bg-white p-3.5 shadow-[0_14px_40px_rgba(0,0,0,0.8)]">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={size} height={size} fill="#ffffff" />
        {grid.matrix.map((row, y) =>
          row.map((on, x) =>
            on ? (
              <rect
                key={`${x}-${y}`}
                x={(x + 1) * cell}
                y={(y + 1) * cell}
                width={cell * 0.96}
                height={cell * 0.96}
                rx={cell * 0.22}
                fill="#000000"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};
