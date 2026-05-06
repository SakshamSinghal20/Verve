import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 110;
const CONNECTION_DIST = 150;
const MOUSE_CONNECT_DIST = 200;
const MOUSE_RADIUS = 160;

const PALETTES = [
    { core: "0, 240, 255", glow: "0, 240, 255" },    // cyan
    { core: "184, 41, 221", glow: "184, 41, 221" },  // purple
    { core: "255, 45, 149", glow: "255, 45, 149" },  // pink
    { core: "255, 255, 255", glow: "200, 220, 255" }, // white/soft blue
];

function ParticleField() {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: null, y: null });
    const particlesRef = useRef([]);
    const starsRef = useRef([]);
    const rafRef = useRef(null);
    const timeRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let w, h;

        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener("resize", resize);

        // Init particles with depth, color, and twinkle phase
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
            const depth = Math.random(); // 0 = far, 1 = near
            const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
            return {
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * (0.3 + depth * 0.5),
                vy: (Math.random() - 0.5) * (0.3 + depth * 0.5),
                baseSize: 0.6 + depth * 1.8,
                size: 0.6 + depth * 1.8,
                depth,
                palette,
                twinklePhase: Math.random() * Math.PI * 2,
                twinkleSpeed: 0.02 + Math.random() * 0.04,
                oscAmpX: Math.random() * 0.3,
                oscAmpY: Math.random() * 0.3,
                oscFreq: 0.005 + Math.random() * 0.01,
                oscPhase: Math.random() * Math.PI * 2,
            };
        });

        function spawnStar() {
            const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 6;
            starsRef.current.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.008 + Math.random() * 0.012,
                size: 1 + Math.random() * 1.5,
                palette,
                trail: [],
            });
        }

        function onMouseMove(e) {
            mouseRef.current.x = e.clientX;
            mouseRef.current.y = e.clientY;
        }
        function onMouseLeave() {
            mouseRef.current.x = null;
            mouseRef.current.y = null;
        }
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseleave", onMouseLeave);

        function draw() {
            timeRef.current += 1;
            const t = timeRef.current;
            ctx.clearRect(0, 0, w, h);
            const particles = particlesRef.current;
            const mouse = mouseRef.current;

            // --- Update & draw particles ---
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                // Organic movement with sine oscillation
                p.x += p.vx + Math.sin(t * p.oscFreq + p.oscPhase) * p.oscAmpX;
                p.y += p.vy + Math.cos(t * p.oscFreq + p.oscPhase) * p.oscAmpY;

                // Wrap edges
                if (p.x < -20) p.x = w + 20;
                if (p.x > w + 20) p.x = -20;
                if (p.y < -20) p.y = h + 20;
                if (p.y > h + 20) p.y = -20;

                // Mouse gentle repulsion
                if (mouse.x != null) {
                    const dx = p.x - mouse.x;
                    const dy = p.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MOUSE_RADIUS && dist > 0) {
                        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
                        p.x += (dx / dist) * force * 1.2;
                        p.y += (dy / dist) * force * 1.2;
                    }
                }

                // Twinkle size
                const twinkle = 0.7 + 0.3 * Math.sin(t * p.twinkleSpeed + p.twinklePhase);
                const size = p.baseSize * twinkle;

                // Draw glow
                const glowR = size * (3 + p.depth * 5);
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
                g.addColorStop(0, `rgba(${p.palette.glow}, ${0.12 * twinkle * (0.5 + p.depth * 0.5)})`);
                g.addColorStop(1, `rgba(${p.palette.glow}, 0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
                ctx.fill();

                // Draw core
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.palette.core}, ${0.5 + p.depth * 0.5})`;
                ctx.fill();
            }

            // --- Draw connections between particles ---
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECTION_DIST) {
                        const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
                        const avgDepth = (particles[i].depth + particles[j].depth) / 2;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * (0.4 + avgDepth * 0.6)})`;
                        ctx.lineWidth = 0.4 + avgDepth * 0.5;
                        ctx.stroke();
                    }
                }
            }

            // --- Mouse web connections ---
            if (mouse.x != null) {
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    const dx = p.x - mouse.x;
                    const dy = p.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MOUSE_CONNECT_DIST) {
                        const alpha = (1 - dist / MOUSE_CONNECT_DIST) * 0.25;
                        ctx.beginPath();
                        ctx.moveTo(mouse.x, mouse.y);
                        ctx.lineTo(p.x, p.y);
                        ctx.strokeStyle = `rgba(${p.palette.glow}, ${alpha})`;
                        ctx.lineWidth = 0.6;
                        ctx.stroke();
                    }
                }
            }

            // --- Shooting stars ---
            // Spawn randomly
            if (Math.random() < 0.008) spawnStar();

            const stars = starsRef.current;
            for (let i = stars.length - 1; i >= 0; i--) {
                const s = stars[i];
                s.x += s.vx;
                s.y += s.vy;
                s.life -= s.decay;

                // Trail
                s.trail.push({ x: s.x, y: s.y, life: s.life });
                if (s.trail.length > 12) s.trail.shift();

                if (s.life <= 0 || s.x < -50 || s.x > w + 50 || s.y < -50 || s.y > h + 50) {
                    stars.splice(i, 1);
                    continue;
                }

                // Draw trail
                if (s.trail.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(s.trail[0].x, s.trail[0].y);
                    for (let j = 1; j < s.trail.length; j++) {
                        ctx.lineTo(s.trail[j].x, s.trail[j].y);
                    }
                    const ta = s.life * 0.3;
                    ctx.strokeStyle = `rgba(${s.palette.glow}, ${ta})`;
                    ctx.lineWidth = s.size * 0.6;
                    ctx.lineCap = "round";
                    ctx.stroke();
                }

                // Draw head glow
                const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
                sg.addColorStop(0, `rgba(${s.palette.glow}, ${s.life * 0.5})`);
                sg.addColorStop(1, `rgba(${s.palette.glow}, 0)`);
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
                ctx.fill();

                // Draw head core
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${s.palette.core}, ${s.life})`;
                ctx.fill();
            }

            rafRef.current = requestAnimationFrame(draw);
        }

        draw();

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseleave", onMouseLeave);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
            }}
            aria-hidden="true"
        />
    );
}

export default ParticleField;
