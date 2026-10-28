import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

// ============================================================
// R-DVNC2000 — Filmadora digital analógica (homenagem à VX2000)
// ============================================================

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_time;
uniform float u_noise;
uniform float u_chroma;
uniform float u_tint;

// Hash pseudoaleatório para grão
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_texCoord;

  // Leve tremor de quadro (instabilidade de fita)
  uv.x += sin(u_time * 2.0 + uv.y * 20.0) * 0.0008;

  // Aberração cromática: amostra R e B deslocados
  vec2 offset = vec2(u_chroma * 0.002, 0.0);
  float r = texture2D(u_texture, uv + offset).r;
  float g = texture2D(u_texture, uv).g;
  float b = texture2D(u_texture, uv - offset).b;
  vec3 color = vec3(r, g, b);

  // Desvio de cor (tungstênio): puxa para verde-azulado
  color.r *= mix(1.0, 0.85, u_tint);
  color.g *= mix(1.0, 1.05, u_tint);
  color.b *= mix(1.0, 1.15, u_tint);

  // Grão / ruído analógico
  float grain = hash(uv * 1000.0 + u_time) - 0.5;
  color += grain * u_noise * 0.25;

  // Linhas de tracking horizontais ocasionais
  float line = step(0.995, fract(uv.y * 80.0 + u_time * 0.3));
  color -= line * 0.06;

  // Vinheta
  vec2 v = uv - 0.5;
  float vignette = smoothstep(0.85, 0.35, length(v));
  color *= mix(0.55, 1.0, vignette);

  // Leve dessaturação e contraste "sujo"
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, 0.85);
  color = (color - 0.5) * 1.12 + 0.5;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

type Fita = "REC" | "STBY";

function App() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const rafRef = useRef<number>(0);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const startTimeRef = useRef<number>(0);

    const [fita, setFita] = useState<Fita>("STBY");
    const [erro, setErro] = useState<string | null>(null);
    const [gravando, setGravando] = useState(false);
    const [contador, setContador] = useState(0); // segundos de fita
    const [urlUltima, setUrlUltima] = useState<string | null>(null);
    const [lensOpen, setLensOpen] = useState(false);

    const [noise, setNoise] = useState(0.6);
    const [chroma, setChroma] = useState(1.0);
    const [tint, setTint] = useState(0.7);

    const setupWebGL = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
        if (!gl) {
            setErro("WebGL não suportado neste navegador.");
            return;
        }
        glRef.current = gl;

        const compile = (type: number, src: string) => {
            const sh = gl.createShader(type)!;
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(sh));
            }
            return sh;
        };

        const program = gl.createProgram()!;
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
        }
        programRef.current = program;
        gl.useProgram(program);

        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const texBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        const aTex = gl.getAttribLocation(program, "a_texCoord");
        gl.enableVertexAttribArray(aTex);
        gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

        // Textura
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        canvas.width = 640;
        canvas.height = 480;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }, []);

    const renderLoop = useCallback(() => {
        const gl = glRef.current;
        const program = programRef.current;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!gl || !program || !video || !canvas) {
            rafRef.current = requestAnimationFrame(renderLoop);
            return;
        }

        if (video.readyState >= video.HAVE_CURRENT_DATA) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

            gl.uniform1f(gl.getUniformLocation(program, "u_time"), performance.now() / 1000);
            gl.uniform1f(gl.getUniformLocation(program, "u_noise"), noise);
            gl.uniform1f(gl.getUniformLocation(program, "u_chroma"), chroma);
            gl.uniform1f(gl.getUniformLocation(program, "u_tint"), tint);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        rafRef.current = requestAnimationFrame(renderLoop);
    }, [noise, chroma, tint]);

    const abrirLente = useCallback(async () => {
        setErro(null);
        if (!window.isSecureContext) {
            setErro("A câmera exige HTTPS ou localhost.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 },
                    facingMode: "environment",
                },
                audio: true,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setupWebGL();
            startTimeRef.current = performance.now();
            setLensOpen(true);
            setFita("STBY");
            rafRef.current = requestAnimationFrame(renderLoop);
        } catch (e) {
            setErro("Falha ao acessar a câmera: " + (e as Error).message);
        }
    }, [renderLoop, setupWebGL]);

    const gravar = useCallback(() => {
        const canvas = canvasRef.current;
        const stream = streamRef.current;
        if (!canvas || !stream) return;

        if (gravando) {
            recorderRef.current?.stop();
            return;
        }

        const canvasStream = (canvas as HTMLCanvasElement).captureStream(24);
        const audioTracks = stream.getAudioTracks();
        const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";

        const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 1500000 });
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            setUrlUltima(url);
            setGravando(false);
            setFita("STBY");
        };

        recorder.start();
        recorderRef.current = recorder;
        setGravando(true);
        setFita("REC");
    }, [gravando]);

    useEffect(() => {
        if (!lensOpen) return;
        const id = setInterval(() => {
            setContador(Math.floor((performance.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(id);
    }, [lensOpen]);

    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current);
            streamRef.current?.getTracks().forEach((t) => t.stop());
            if (urlUltima) URL.revokeObjectURL(urlUltima);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const formatarContador = (s: number) => {
        const m = Math.floor(s / 60)
            .toString()
            .padStart(2, "0");
        const seg = (s % 60).toString().padStart(2, "0");
        return `${m}:${seg}`;
    };

    return (
        <div className="rdvnc-app">
            <div className="visor">
                <video ref={videoRef} playsInline muted style={{ display: "none" }} />
                <canvas ref={canvasRef} className="lcd" />

                <div className="osd osd-top">
                    <span className={`rec-dot ${gravando ? "on" : ""}`}>●</span>
                    <span>{fita}</span>
                    <span className="spacer" />
                    <span>{formatarContador(contador)}</span>
                </div>
                <div className="osd osd-bottom">
                    <span>SD 640×480</span>
                    <span>24fps</span>
                    <span>WB 3200K</span>
                    <span>ISO AUTO</span>
                </div>

                {!lensOpen && (
                    <div className="overlay-inicial">
                        <h1>RDVNC2000</h1>
                        <p>Filmadora digital analógica</p>
                        <p>Night City Edition</p>
                        <button onClick={abrirLente} className="btn-lente">
                            ⏻ ABRIR LENTE
                        </button>
                        {erro && <p className="erro">{erro}</p>}
                    </div>
                )}
            </div>

            <div className="painel">
                <div className="controle">
                    <label>
                        RUÍDO <span>{noise.toFixed(2)}</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.01" value={noise} onChange={(e) => setNoise(parseFloat(e.target.value))} />
                </div>
                <div className="controle">
                    <label>
                        ABERRAÇÃO <span>{chroma.toFixed(2)}</span>
                    </label>
                    <input type="range" min="0" max="3" step="0.01" value={chroma} onChange={(e) => setChroma(parseFloat(e.target.value))} />
                </div>
                <div className="controle">
                    <label>
                        TUNGSTÊNIO <span>{tint.toFixed(2)}</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.01" value={tint} onChange={(e) => setTint(parseFloat(e.target.value))} />
                </div>

                <div className="botoes">
                    <button className={`btn-rec ${gravando ? "gravando" : ""}`} onClick={gravar} disabled={!lensOpen}>
                        {gravando ? "■ STOP" : "● REC"}
                    </button>

                    <input type="checkbox" id="toggle-tema" />
                    <label htmlFor="toggle-tema" className="btn-tema" aria-label="Trocar tema" />
                </div>

                {urlUltima && (
                    <a href={urlUltima} download={`R-DVNC2000_${Date.now()}.webm`} className="btn-download">
                        ⬇ SALVAR FITA
                    </a>
                )}
            </div>
        </div>
    );
}

export default App;
