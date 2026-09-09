import { GLYPHS, PORTRAIT_HEIGHT, PORTRAIT_ROWS, PORTRAIT_WIDTH } from './tibo-ascii-data.mjs';

const vertexSource = `
attribute vec2 a_position;
attribute float a_glyph;
attribute float a_seed;
attribute float a_edge;
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_point_size;
uniform float u_motion;
varying float v_glyph;
varying float v_alpha;

void main() {
  float t = u_time * 0.001;
  float breath = sin(t * 0.42 + a_seed * 6.2831853);
  float drift = sin(t * 0.31 + a_seed * 19.0);
  vec2 position = a_position;
  position += u_pointer * vec2(0.016, -0.012) * (0.35 + a_seed * 0.65) * u_motion;
  position.x += drift * (0.0025 + a_edge * 0.0060) * u_motion;
  position.y += breath * (0.0018 + a_edge * 0.0045) * u_motion;
  gl_Position = vec4(position, 0.0, 1.0);
  gl_PointSize = u_point_size * (1.0 + breath * 0.035 * u_motion);
  v_glyph = a_glyph;
  v_alpha = 0.42 + min(a_glyph / 9.0, 1.0) * 0.48;
}
`;

const fragmentSource = `
precision mediump float;
uniform sampler2D u_atlas;
varying float v_glyph;
varying float v_alpha;

void main() {
  float glyph = floor(v_glyph + 0.5);
  vec2 uv = vec2((glyph + gl_PointCoord.x) / 10.0, 1.0 - gl_PointCoord.y);
  float alpha = texture2D(u_atlas, uv).a;
  if (alpha < 0.08) discard;
  gl_FragColor = vec4(0.055, 0.06, 0.06, alpha * v_alpha);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'shader_compile_failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'program_link_failed';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function createAtlas(gl) {
  const cell = 64;
  const atlas = document.createElement('canvas');
  atlas.width = cell * GLYPHS.length;
  atlas.height = cell;
  const context = atlas.getContext('2d', { alpha: true });
  if (!context) throw new Error('glyph_atlas_unavailable');
  context.clearRect(0, 0, atlas.width, atlas.height);
  context.fillStyle = '#fff';
  context.font = '600 46px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let index = 0; index < GLYPHS.length; index += 1) {
    context.fillText(GLYPHS[index], index * cell + cell / 2, cell / 2 + 2);
  }

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  return texture;
}

function pointData() {
  const points = [];
  const present = (row, column) => {
    const line = PORTRAIT_ROWS[row] || '';
    return column >= 0 && column < line.length && GLYPHS.indexOf(line[column]) > 0;
  };

  for (let row = 0; row < PORTRAIT_HEIGHT; row += 1) {
    const line = PORTRAIT_ROWS[row] || '';
    for (let column = 0; column < PORTRAIT_WIDTH; column += 1) {
      const glyph = GLYPHS.indexOf(line[column] || ' ');
      if (glyph <= 0) continue;
      const x = ((column / (PORTRAIT_WIDTH - 1)) * 2 - 1) * 0.72;
      const y = (1 - (row / (PORTRAIT_HEIGHT - 1)) * 2) * 0.96;
      const seed = ((row * 91 + column * 47) % 997) / 997;
      const neighbors = [
        present(row - 1, column),
        present(row + 1, column),
        present(row, column - 1),
        present(row, column + 1)
      ];
      const edge = neighbors.every(Boolean) ? 0 : 1;
      points.push(x, y, glyph, seed, edge);
    }
  }
  return new Float32Array(points);
}

function fallbackText() {
  return PORTRAIT_ROWS.map(row => row.padEnd(PORTRAIT_WIDTH, ' ')).join('\n');
}

function showFallback(canvas, fallback) {
  canvas.hidden = true;
  fallback.hidden = false;
  fallback.textContent = fallbackText();
}

export function initAsciiPortrait(canvas, fallback) {
  if (!canvas || !fallback) return () => {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power'
    });
  } catch {
    gl = null;
  }
  if (!gl) {
    showFallback(canvas, fallback);
    return () => {};
  }

  let program;
  try {
    program = createProgram(gl);
  } catch {
    showFallback(canvas, fallback);
    return () => {};
  }

  const data = pointData();
  const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.useProgram(program);

  const attributes = [
    ['a_position', 2, 0],
    ['a_glyph', 1, 2 * Float32Array.BYTES_PER_ELEMENT],
    ['a_seed', 1, 3 * Float32Array.BYTES_PER_ELEMENT],
    ['a_edge', 1, 4 * Float32Array.BYTES_PER_ELEMENT]
  ];
  for (const [name, size, offset] of attributes) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  }

  let atlas;
  try {
    atlas = createAtlas(gl);
  } catch {
    showFallback(canvas, fallback);
    return () => {};
  }
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const pointerLocation = gl.getUniformLocation(program, 'u_pointer');
  const pointSizeLocation = gl.getUniformLocation(program, 'u_point_size');
  const motionLocation = gl.getUniformLocation(program, 'u_motion');
  gl.uniform1i(gl.getUniformLocation(program, 'u_atlas'), 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlas);

  let frame = 0;
  let visible = !document.hidden;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    const pointSize = Math.max(2, Math.min(width * 0.72 / PORTRAIT_WIDTH, height * 0.96 / PORTRAIT_HEIGHT) * 1.42);
    gl.uniform1f(pointSizeLocation, pointSize);
  }

  function draw(now = 0) {
    frame = 0;
    resize();
    const motion = reducedMotion.matches ? 0 : 1;
    pointerX += (targetX - pointerX) * 0.06;
    pointerY += (targetY - pointerY) * 0.06;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(timeLocation, now);
    gl.uniform2f(pointerLocation, pointerX, pointerY);
    gl.uniform1f(motionLocation, motion);
    gl.drawArrays(gl.POINTS, 0, data.length / 5);
    if (visible && !reducedMotion.matches) frame = requestAnimationFrame(draw);
  }

  function start() {
    if (!visible || reducedMotion.matches || frame) return;
    frame = requestAnimationFrame(draw);
  }

  function stop() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function onPointer(event) {
    if (reducedMotion.matches) return;
    const rect = canvas.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
  }

  function resetPointer() {
    targetX = 0;
    targetY = 0;
  }

  function onVisibility() {
    visible = !document.hidden;
    if (visible) {
      draw(performance.now());
      start();
    } else {
      stop();
    }
  }

  function onMotionChange() {
    stop();
    draw(performance.now());
    start();
  }

  function onContextLost(event) {
    event.preventDefault();
    stop();
    showFallback(canvas, fallback);
  }

  canvas.addEventListener('pointermove', onPointer, { passive: true });
  canvas.addEventListener('pointerleave', resetPointer, { passive: true });
  canvas.addEventListener('webglcontextlost', onContextLost, { passive: false });
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener?.('change', onMotionChange);
  window.addEventListener('resize', resize, { passive: true });

  draw(performance.now());
  start();

  return () => {
    stop();
    canvas.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('pointerleave', resetPointer);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    document.removeEventListener('visibilitychange', onVisibility);
    reducedMotion.removeEventListener?.('change', onMotionChange);
    window.removeEventListener('resize', resize);
  };
}
