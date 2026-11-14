import React, { useEffect, useRef } from 'react';

// ============================================================================
// WEBGL GLSL SHADER: PURE BLACK OLED + MULTI-DEPTH SNOWFALL + LIQUID RIPPLE
// ============================================================================

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_pointer;
  uniform float u_ripple;

  // Хэш-функции без видимых паттернов
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  // Процедурный слой снега с мягким боке, ветром и мерцанием
  float snowLayer(vec2 uv, float scale, float speed, float time, float seed, float blurAmount) {
    uv *= scale;
    // Падение вниз + синусоидальный ветер
    uv.y += time * speed;
    uv.x += sin(uv.y * 0.45 + time * 0.32 + seed) * 0.34 + cos(time * 0.18 + seed) * 0.25;

    vec2 id = floor(uv);
    vec2 f = fract(uv) - 0.5;

    float flake = 0.0;

    // Проверяем 3x3 соседних ячеек чтобы снежинки плавно переходили границы
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offs = vec2(float(x), float(y));
        vec2 cellId = id + offs + seed * 17.31;
        vec2 rnd = hash22(cellId);

        // Прореживание плотности — чистый, не перегруженный снегопад
        if (rnd.x < 0.42) continue;

        float phase = rnd.y * 6.2831;
        vec2 pos = offs + (rnd - 0.5) * 0.72;
        pos.x += sin(time * (0.6 + rnd.x * 0.8) + phase) * 0.14;
        pos.y += cos(time * (0.4 + rnd.y * 0.6) + phase) * 0.08;

        float d = length(f - pos);
        float radius = mix(0.022, 0.072, hash12(cellId + 4.2));
        float soft = radius + blurAmount;

        float glow = smoothstep(soft, radius * 0.15, d);
        float core = smoothstep(radius * 0.85, 0.0, d);

        // Деликатное мерцание кристаллов
        float twinkle = 0.72 + 0.28 * sin(time * (1.5 + rnd.y * 2.5) + phase);
        flake += (glow * 0.52 + core * 0.65) * twinkle;
      }
    }

    return flake;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec2 ptrUv = (u_pointer - 0.5 * u_resolution.xy) / u_resolution.y;

    // Лёгкое жидкое преломление пространства вокруг точки касания/курсора
    vec2 toPtr = uv - ptrUv;
    float ptrDist = length(toPtr);
    float wave = sin(ptrDist * 22.0 - u_time * 5.0) * exp(-ptrDist * 5.5) * u_ripple;
    uv += normalize(toPtr + vec2(0.0001)) * wave * 0.022;

    float t = u_time;
    float snow = 0.0;

    // 6 слоёв глубины: от далёкой снежной пыли до крупных мягких хлопьев на переднем плане
    snow += snowLayer(uv, 18.0, 0.34, t, 1.1, 0.04) * 0.20;
    snow += snowLayer(uv, 13.0, 0.48, t, 2.7, 0.05) * 0.30;
    snow += snowLayer(uv, 9.2,  0.64, t, 4.3, 0.065) * 0.46;
    snow += snowLayer(uv, 6.4,  0.86, t, 6.9, 0.085) * 0.62;
    snow += snowLayer(uv, 4.2,  1.12, t, 9.5, 0.125) * 0.78;
    snow += snowLayer(uv, 2.7,  1.42, t, 13.1, 0.20) * 0.58;

    // Едва заметное верхнее холодное сияние в абсолютной черноте (строго монохром)
    float topAura = smoothstep(1.3, -0.4, uv.y) * 0.024;
    float touchGlow = exp(-ptrDist * 4.2) * u_ripple * 0.045;

    float luminance = clamp(snow + topAura + touchGlow, 0.0, 1.0);
    gl_FragColor = vec4(vec3(luminance), 1.0);
  }
`;

export const SnowLiquidShader: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });

    // Fallback на Canvas2D, если WebGL недоступен
    if (!gl) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId = 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const resize2d = () => {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize2d();
      window.addEventListener('resize', resize2d);

      const flakes = Array.from({ length: 110 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 0.8 + Math.random() * 2.5,
        vy: 0.35 + Math.random() * 1.1,
        vx: (Math.random() - 0.5) * 0.35,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.2 + Math.random() * 0.65,
      }));

      const render2d = (now: number) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        for (const f of flakes) {
          f.y += f.vy;
          f.x += f.vx + Math.sin(now * 0.0008 + f.phase) * 0.28;
          if (f.y > window.innerHeight + 10) {
            f.y = -10;
            f.x = Math.random() * window.innerWidth;
          }
          if (f.x < -10) f.x = window.innerWidth + 10;
          if (f.x > window.innerWidth + 10) f.x = -10;

          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${f.alpha})`;
          ctx.fill();
        }
        animId = requestAnimationFrame(render2d);
      };
      animId = requestAnimationFrame(render2d);

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize2d);
      };
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const ptrLoc = gl.getUniformLocation(program, 'u_pointer');
    const rippleLoc = gl.getUniformLocation(program, 'u_ripple');

    let width = 0;
    let height = 0;
    const pointer = { x: 0, y: 0, targetRipple: 0, ripple: 0 };

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = Math.floor(window.innerWidth * dpr);
      height = Math.floor(window.innerHeight * dpr);
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    handleResize();
    pointer.x = width * 0.5;
    pointer.y = height * 0.5;

    const onPointerMove = (e: PointerEvent) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      pointer.x = e.clientX * dpr;
      pointer.y = (window.innerHeight - e.clientY) * dpr;
      pointer.targetRipple = 1.0;
    };

    const onPointerDown = (e: PointerEvent) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      pointer.x = e.clientX * dpr;
      pointer.y = (window.innerHeight - e.clientY) * dpr;
      pointer.targetRipple = 1.35;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    let animId = 0;
    const start = performance.now();

    const render = (now: number) => {
      const elapsed = (now - start) * 0.001;
      pointer.targetRipple *= 0.965;
      pointer.ripple += (pointer.targetRipple - pointer.ripple) * 0.12;

      gl.uniform2f(resLoc, width, height);
      gl.uniform1f(timeLoc, elapsed);
      gl.uniform2f(ptrLoc, pointer.x, pointer.y);
      gl.uniform1f(rippleLoc, pointer.ripple);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 h-full w-full pointer-events-none select-none z-0"
    />
  );
};
