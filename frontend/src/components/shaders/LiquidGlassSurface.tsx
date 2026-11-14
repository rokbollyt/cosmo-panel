import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { JELLY_CARD_TAP } from '../../utils/motion';
import { cn } from '../../utils/cn';

// ============================================================================
// ГЛОБАЛЬНЫЙ SVG-ФИЛЬТР ОПТИЧЕСКОЙ РЕФРАКЦИИ ЖИДКОГО СТЕКЛА
// Монтируется 1 раз в корне приложения; используется для преломления бликового слоя
// ============================================================================

export const LiquidGlassFilterDefs: React.FC = () => (
  <svg
    aria-hidden="true"
    width="0"
    height="0"
    style={{ position: 'fixed', width: 0, height: 0, pointerEvents: 'none' }}
  >
    <defs>
      <filter
        id="liquid-glass-refract"
        x="-10%"
        y="-10%"
        width="120%"
        height="120%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.012 0.018"
          numOctaves="2"
          seed="7"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2.5" result="smoothNoise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="smoothNoise"
          scale="18"
          xChannelSelector="R"
          yChannelSelector="G"
          result="refracted"
        />
        <feSpecularLighting
          in="smoothNoise"
          surfaceScale="2.6"
          specularConstant="0.55"
          specularExponent="28"
          lightingColor="#ffffff"
          result="specular"
        >
          <fePointLight x="-80" y="-120" z="220" />
        </feSpecularLighting>
        <feComposite in="specular" in2="SourceAlpha" operator="in" result="clippedSpec" />
        <feBlend in="refracted" in2="clippedSpec" mode="screen" />
      </filter>
    </defs>
  </svg>
);

// ============================================================================
// REAL-TIME WEBGL GLSL LIQUID GLASS CAUSTICS & FRESNEL SHADER
// Используется на ключевых панелях (Hero, Dock, Подписка) — безопасно по лимиту контекстов
// ============================================================================

const LIQUID_VS = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const LIQUID_FS = `
  precision mediump float;

  varying vec2 v_uv;
  uniform vec2 u_res;
  uniform float u_time;
  uniform vec2 u_pointer;
  uniform float u_intensity;

  // Гладкий value-noise для жидкой оптики
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = rot * p * 2.05;
      a *= 0.5;
    }
    return v;
  }

  // Высота жидкого стекла (domain-warped)
  float liquidHeight(vec2 p, float t) {
    vec2 q = vec2(
      fbm(p * 1.45 + vec2(t * 0.14, -t * 0.11)),
      fbm(p * 1.45 + vec2(-t * 0.10 + 4.1, t * 0.16 + 1.8))
    );
    return fbm(p * 1.9 + q * 1.65 + vec2(t * 0.08, t * 0.06));
  }

  void main() {
    vec2 uv = v_uv;
    float aspect = u_res.x / max(u_res.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    float t = u_time;

    // Вычисляем нормаль поверхности жидкого стекла по градиенту
    float eps = 0.018;
    float hC = liquidHeight(p, t);
    float hX = liquidHeight(p + vec2(eps, 0.0), t);
    float hY = liquidHeight(p + vec2(0.0, eps), t);

    // Искривление нормали у краёв стекла (эффект выпуклой линзы / фаски)
    vec2 edge = abs(uv - 0.5) * 2.0;
    float edgeFactor = smoothstep(0.55, 1.0, max(edge.x, edge.y));
    vec2 bevelDir = normalize((uv - 0.5) + vec2(0.0001)) * edgeFactor * 0.55;

    vec3 N = normalize(vec3((hC - hX) * 3.8 + bevelDir.x, (hC - hY) * 3.8 + bevelDir.y, 0.72));

    // Два источника света: верхний мягкий студийный + интерактивный от касания
    vec2 lightPtr = vec2((u_pointer.x - 0.5) * aspect, u_pointer.y - 0.5);
    vec3 L1 = normalize(vec3(-0.65, 0.85, 0.95));
    vec3 L2 = normalize(vec3(lightPtr - p, 0.58));
    vec3 V = vec3(0.0, 0.0, 1.0);

    vec3 H1 = normalize(L1 + V);
    vec3 H2 = normalize(L2 + V);

    // Острые зеркальные блики + шелковистая жидкая каустика
    float spec1 = pow(max(dot(N, H1), 0.0), 16.0);
    float spec2 = pow(max(dot(N, H2), 0.0), 14.0) * exp(-length(lightPtr - p) * 2.1);

    // Френелевское отражение на гранях жидкого стекла
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);

    // Тонкие линии каустики на стыке волн
    float caustic = smoothstep(0.62, 0.92, hC) * 0.42;

    // Усиление кромки сверху и снизу как у толстого оптического стекла
    float topRim = smoothstep(0.84, 1.0, uv.y) * 0.36;
    float bottomRim = smoothstep(0.14, 0.0, uv.y) * 0.16;

    float alpha = (spec1 * 0.28 + spec2 * 0.34 + fresnel * 0.24 + caustic * 0.18 + topRim + bottomRim) * u_intensity;
    alpha = clamp(alpha, 0.0, 0.48);

    // Строго чистый монохромный белый блик
    gl_FragColor = vec4(vec3(1.0) * alpha, alpha);
  }
`;

export const LiquidShaderOverlay: React.FC<{
  className?: string;
  intensity?: number;
}> = ({ className, intensity = 0.85 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0.25, y: 0.8 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'default',
    });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, LIQUID_VS);
    const fs = compile(gl.FRAGMENT_SHADER, LIQUID_FS);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(prog, 'u_res');
    const timeLoc = gl.getUniformLocation(prog, 'u_time');
    const ptrLoc = gl.getUniformLocation(prog, 'u_pointer');
    const intLoc = gl.getUniformLocation(prog, 'u_intensity');

    let w = 1;
    let h = 1;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      // Низкий scale фактора рендеринга для идеальных 60fps: жидкий блик сам по себе плавный
      w = Math.max(2, Math.floor(rect.width * 0.6));
      h = Math.max(2, Math.floor(rect.height * 0.6));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(canvas);

    const onGlobalPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      pointerRef.current.x = Math.max(-0.5, Math.min(1.5, nx));
      pointerRef.current.y = Math.max(-0.5, Math.min(1.5, ny));
    };

    window.addEventListener('pointermove', onGlobalPointer, { passive: true });
    window.addEventListener('pointerdown', onGlobalPointer, { passive: true });

    let animId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) * 0.001;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resLoc, w, h);
      gl.uniform1f(timeLoc, t);
      gl.uniform2f(ptrLoc, pointerRef.current.x, pointerRef.current.y);
      gl.uniform1f(intLoc, intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener('pointermove', onGlobalPointer);
      window.removeEventListener('pointerdown', onGlobalPointer);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full rounded-[inherit] mix-blend-screen z-[1]',
        className
      )}
    />
  );
};

// ============================================================================
// УНИВЕРСАЛЬНАЯ КАРТОЧКА LIQUID GLASS
// Поддерживает оптический SVG-блик, опциональный GLSL-шейдер и желейный тап
// ============================================================================

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
  shader?: boolean;
  shaderIntensity?: number;
  interactive?: boolean;
  onClick?: () => void;
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  className,
  strong = false,
  shader = false,
  shaderIntensity = 0.78,
  interactive = false,
  onClick,
}) => {
  const [glowPos, setGlowPos] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 0,
    active: false,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setGlowPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      active: true,
    });
  };

  return (
    <motion.div
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setGlowPos((prev) => ({ ...prev, active: false }))}
      whileTap={interactive ? JELLY_CARD_TAP : undefined}
      className={cn(
        'overflow-hidden rounded-[26px]',
        strong ? 'liquid-glass-strong' : 'liquid-glass',
        interactive && 'cursor-pointer select-none',
        className
      )}
    >
      {/* Оптический слой преломления линзы */}
      <div className="liquid-lens-sheen" aria-hidden="true" />

      {/* Интерактивный зеркальный спотлайт от пальца/курсора */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: glowPos.active ? 1 : 0,
          background: `radial-gradient(240px circle at ${glowPos.x}% ${glowPos.y}%, rgba(255,255,255,0.14), transparent 68%)`,
        }}
      />

      {/* Живой WebGL GLSL-шейдер жидкого стекла (для фокусных панелей) */}
      {shader && <LiquidShaderOverlay intensity={shaderIntensity} />}

      {/* Контент поверх оптического стекла — всегда 100% чёткий */}
      <div className="relative z-[3]">{children}</div>
    </motion.div>
  );
};
