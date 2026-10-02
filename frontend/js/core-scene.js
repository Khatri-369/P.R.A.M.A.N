// A dependency-free WebGL evidence core. No models, textures, or business data.
export function mountCore(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "core-canvas";
  canvas.setAttribute("aria-hidden", "true");
  let gl;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return;
  }
  if (!gl) return; // The HTML/CSS seal remains visible as a fallback.
  const vertex = `attribute vec3 position; attribute vec3 color; attribute vec3 normal; varying vec3 tint;
    uniform float angle; uniform float aspect; uniform vec2 pointer;
    void main(){
      float a=angle+pointer.x; float b=.35+pointer.y;
      vec3 p=position;
      p=vec3(cos(a)*p.x+sin(a)*p.z,p.y,-sin(a)*p.x+cos(a)*p.z);
      p=vec3(p.x,cos(b)*p.y-sin(b)*p.z,sin(b)*p.y+cos(b)*p.z);
      float d=4.8-p.z;
      gl_Position=vec4(p.x*2.65/aspect,p.y*2.65,-p.z,d);
      gl_PointSize=3.0;
      vec3 n=normal;
      n=vec3(cos(a)*n.x+sin(a)*n.z,n.y,-sin(a)*n.x+cos(a)*n.z);
      n=vec3(n.x,cos(b)*n.y-sin(b)*n.z,sin(b)*n.y+cos(b)*n.z);
      float light=max(dot(n,normalize(vec3(-.5,.8,1.))),0.);
      float shine=pow(max(dot(n,normalize(vec3(-.25,.4,1.))),0.),18.);
      tint=length(normal)>.5 ? color*(.38+.62*light)+vec3(1.,.7,.18)*shine*.4 : color;
    }`;
  const fragment = `precision mediump float; varying vec3 tint; void main(){gl_FragColor=vec4(tint,1.);}`;
  const shader = (type, source) => {
    const item = gl.createShader(type);
    gl.shaderSource(item, source);
    gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
      gl.deleteShader(item);
      throw new Error("Shader unavailable");
    }
    return item;
  };
  let program, vs, fs;
  try {
    vs = shader(gl.VERTEX_SHADER, vertex);
    fs = shader(gl.FRAGMENT_SHADER, fragment);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("WebGL unavailable");
  } catch {
    gl.deleteProgram(program);
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return;
  }
  gl.useProgram(program);
  const data = [];
  const amber = [0.54, 0.29, 0.1],
    graphite = [0.3, 0.29, 0.26];
  const line = (a, b, c = graphite) =>
    data.push(...a, ...c, 0, 0, 0, ...b, ...c, 0, 0, 0);
  // Restore the original full-depth icosahedron, now with solid sun-orange faces.
  const phi = (1 + Math.sqrt(5)) / 2,
    vertices = [];
  for (const a of [-1, 1])
    for (const b of [-phi, phi]) {
      vertices.push(
        [0, a * 0.51, b * 0.51],
        [a * 0.51, b * 0.51, 0],
        [b * 0.51, 0, a * 0.51],
      );
    }
  const adjacent = (a, b) => Math.hypot(...a.map((v, k) => v - b[k])) < 1.03;
  for (let i = 0; i < vertices.length; i++)
    for (let j = i + 1; j < vertices.length; j++)
      for (let k = j + 1; k < vertices.length; k++) {
        const a = vertices[i],
          b = vertices[j],
          c = vertices[k];
        if (!adjacent(a, b) || !adjacent(b, c) || !adjacent(c, a)) continue;
        const u = b.map((v, n) => v - a[n]),
          v = c.map((v, n) => v - a[n]);
        let normal = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        const sign =
          normal.reduce((sum, value, n) => sum + value * a[n], 0) < 0 ? -1 : 1;
        const length = Math.hypot(...normal);
        normal = normal.map((value) => (value / length) * sign);
        for (const point of [a, b, c])
          data.push(...point, 1, 0.4, 0.025, ...normal);
      }
  const triangleCount = data.length / 9;
  // Orbital paths occupy different planes, with a sparse outer geodesic cage.
  const segments = window.innerWidth < 600 ? 48 : 80;
  for (let ring = 0; ring < 3; ring++)
    for (let i = 0; i < segments; i++) {
      const point = (n) => {
        const t = (n / segments) * Math.PI * 2,
          r = 1.45 + ring * 0.16;
        const x = Math.cos(t) * r,
          y = Math.sin(t) * r;
        return ring === 0
          ? [x, y * 0.38, y * 0.92]
          : ring === 1
            ? [x * 0.45, y, x * 0.89]
            : [x, y * 0.8, -y * 0.6];
      };
      line(point(i), point(i + 1), ring === 1 ? amber : graphite);
    }
  const lineCount = data.length / 9 - triangleCount;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  for (const [name, offset] of [
    ["position", 0],
    ["color", 12],
    ["normal", 24],
  ]) {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 36, offset);
  }
  const angle = gl.getUniformLocation(program, "angle"),
    aspect = gl.getUniformLocation(program, "aspect"),
    pointer = gl.getUniformLocation(program, "pointer");
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  host.append(canvas);
  host.classList.add("has-webgl");
  const container = host.closest(".forensic-visual") || host.parentElement;
  container.classList.add("scene-shell");
  // The visualization is decorative, but its motion control is keyboard accessible.
  const decorative = container.hasAttribute("aria-hidden");
  if (decorative) container.removeAttribute("aria-hidden");
  host.setAttribute("aria-hidden", "true");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "motion-toggle";
  container.append(button);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reduced.matches,
    visible = false,
    frame = 0,
    last = 0,
    rotation = 0.35,
    px = 0,
    py = 0,
    disposed = false;
  const label = () => {
    button.textContent = paused ? "Play 3D motion" : "Pause 3D motion";
    button.setAttribute("aria-pressed", String(!paused));
  };
  label();
  const draw = () => {
    if (disposed) return;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(angle, rotation);
    gl.uniform1f(aspect, canvas.width / canvas.height);
    gl.uniform2f(pointer, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, triangleCount);
    gl.drawArrays(gl.LINES, triangleCount, lineCount);
  };
  const tick = (now) => {
    frame = 0;
    if (!visible || document.hidden || paused || disposed) return;
    if (now - last >= 33) {
      rotation += Math.min(now - last, 50) * 0.00015;
      last = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = performance.now();
    if (visible && !document.hidden && !paused && !disposed)
      frame = requestAnimationFrame(tick);
  };
  const resize = new ResizeObserver(() => {
    const box = host.getBoundingClientRect(),
      ratio = Math.min(devicePixelRatio, innerWidth < 600 ? 1 : 1.5);
    canvas.width = Math.max(1, Math.round(box.width * ratio));
    canvas.height = Math.max(1, Math.round(box.height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  });
  resize.observe(host);
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    },
    { threshold: 0.05 },
  );
  observer.observe(host);
  const preference = () => {
    paused = reduced.matches;
    label();
    schedule();
    draw();
  };
  reduced.addEventListener("change", preference);
  const visibility = () => schedule();
  document.addEventListener("visibilitychange", visibility);
  button.addEventListener("click", () => {
    paused = !paused;
    label();
    schedule();
  });
  container.addEventListener("pointermove", (event) => {
    if (paused || reduced.matches || event.pointerType === "touch") return;
    const r = host.getBoundingClientRect();
    px = ((event.clientX - r.left) / r.width - 0.5) * 0.2;
    py = ((event.clientY - r.top) / r.height - 0.5) * 0.15;
  });
  container.addEventListener("pointerleave", () => {
    px = 0;
    py = 0;
  });
  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    observer.disconnect();
    reduced.removeEventListener("change", preference);
    document.removeEventListener("visibilitychange", visibility);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      dispose();
      canvas.remove();
      button.remove();
      host.classList.remove("has-webgl");
    },
    { once: true },
  );
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) dispose();
    },
    { once: true },
  );
}
