import { Component, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The "work graph" behind the sign-in card.
 *
 * It mirrors the product's own structure: one root (the organisation), a few hubs
 * (managers and team leads), their tasks around them, and a handful of
 * cross-team dependencies. Green nodes are completed work.
 *
 * Loaded lazily so three.js never delays the sign-in form, and it steps aside
 * (renders nothing or a single still frame) when WebGL is missing, the OS asks for
 * reduced motion, or the device is low-powered.
 */

type Kind = 'root' | 'hub' | 'task' | 'done';
interface GraphNode {
    pos: THREE.Vector3;
    size: number;
    kind: Kind;
    phase: number;
}

const makeRng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const HUBS = 4;
const TASKS_PER_HUB = 7;

const buildGraph = () => {
    const rand = makeRng(42); // fixed seed: the same picture every visit
    const nodes: GraphNode[] = [{ pos: new THREE.Vector3(), size: 0.2, kind: 'root', phase: 0 }];
    const edges: Array<[number, number]> = [];
    const hubDirs = [
        [1, 1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, -1, -1],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

    hubDirs.slice(0, HUBS).forEach((dir) => {
        const hubIndex = nodes.length;
        const hubPos = dir.clone().multiplyScalar(2.1);
        nodes.push({ pos: hubPos, size: 0.14, kind: 'hub', phase: rand() * 6.28 });
        edges.push([0, hubIndex]);
        for (let i = 0; i < TASKS_PER_HUB; i++) {
            const offset = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5)
                .normalize()
                .multiplyScalar(1 + rand() * 0.7)
                .add(dir.clone().multiplyScalar(0.5));
            const index = nodes.length;
            nodes.push({
                pos: hubPos.clone().add(offset),
                size: 0.06 + rand() * 0.05,
                kind: rand() < 0.3 ? 'done' : 'task',
                phase: rand() * 6.28,
            });
            edges.push([hubIndex, index]);
        }
    });

    // Cross-team dependencies: link the closest task pairs that belong to different hubs.
    const groupOf = (i: number) => Math.floor((i - 1) / (TASKS_PER_HUB + 1));
    const isTask = (i: number) => nodes[i].kind === 'task' || nodes[i].kind === 'done';
    const candidates: Array<{ a: number; b: number; d: number }> = [];
    for (let a = 1; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
            if (isTask(a) && isTask(b) && groupOf(a) !== groupOf(b)) {
                candidates.push({ a, b, d: nodes[a].pos.distanceTo(nodes[b].pos) });
            }
        }
    }
    candidates.sort((x, y) => x.d - y.d);
    candidates.slice(0, 10).forEach(({ a, b }) => edges.push([a, b]));
    return { nodes, edges };
};

const cssVar = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function Graph({ animate }: { animate: boolean }) {
    const graph = useMemo(buildGraph, []);
    const outer = useRef<THREE.Group>(null);
    const spin = useRef<THREE.Group>(null);
    const mesh = useRef<THREE.InstancedMesh>(null);
    const pointer = useRef({ x: 0, y: 0 });
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const width = useThree((s) => s.size.width);

    const palette = useMemo(() => {
        const accent = new THREE.Color(cssVar('--accent-color', '#3b82f6'));
        return {
            root: accent.clone().lerp(new THREE.Color('#ffffff'), 0.55),
            hub: accent,
            task: new THREE.Color('#64748b'),
            done: new THREE.Color(cssVar('--success', '#22c55e')),
            edge: accent.clone().lerp(new THREE.Color('#94a3b8'), 0.4),
            fog: cssVar('--bg-primary', '#0f172a'),
        };
    }, []);

    const lines = useMemo(() => {
        const points: number[] = [];
        graph.edges.forEach(([a, b]) => {
            const A = graph.nodes[a].pos;
            const B = graph.nodes[b].pos;
            points.push(A.x, A.y, A.z, B.x, B.y, B.z);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        return geometry;
    }, [graph]);

    useLayoutEffect(() => {
        const m = mesh.current;
        if (!m) return;
        graph.nodes.forEach((n, i) => {
            m.setColorAt(i, palette[n.kind]);
            dummy.position.copy(n.pos);
            dummy.scale.setScalar(n.size);
            dummy.updateMatrix();
            m.setMatrixAt(i, dummy.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }, [graph, palette, dummy]);

    useEffect(() => {
        if (!animate) return;
        const onMove = (e: PointerEvent) => {
            pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => window.removeEventListener('pointermove', onMove);
    }, [animate]);

    useFrame(({ clock }, delta) => {
        if (!animate || !outer.current || !spin.current || !mesh.current) return;
        spin.current.rotation.y += delta * 0.06;
        // Ease toward the pointer for a gentle parallax.
        outer.current.rotation.y += (pointer.current.x * 0.3 - outer.current.rotation.y) * 0.04;
        outer.current.rotation.x += (pointer.current.y * 0.2 - outer.current.rotation.x) * 0.04;

        const t = clock.elapsedTime;
        graph.nodes.forEach((n, i) => {
            dummy.position.copy(n.pos);
            dummy.scale.setScalar(n.size * (1 + 0.1 * Math.sin(t * 1.1 + n.phase)));
            dummy.updateMatrix();
            mesh.current!.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    const scale = width < 700 ? 0.7 : 1;

    return (
        <>
            <fog attach="fog" args={[palette.fog, 6, 13]} />
            <group ref={outer} scale={scale}>
                <group ref={spin} rotation={[0.25, 0.6, 0]}>
                    <lineSegments geometry={lines}>
                        <lineBasicMaterial color={palette.edge} transparent opacity={0.3} />
                    </lineSegments>
                    <instancedMesh ref={mesh} args={[undefined, undefined, graph.nodes.length]}>
                        <icosahedronGeometry args={[1, 2]} />
                        <meshBasicMaterial toneMapped={false} />
                    </instancedMesh>
                </group>
            </group>
        </>
    );
}

// If the 3D scene fails for any reason, the sign-in page must keep working.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

const webglAvailable = (): boolean => {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
};

export default function LoginScene() {
    const supported = useMemo(webglAvailable, []);
    const animate = useMemo(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const lowPower = (navigator.hardwareConcurrency ?? 8) <= 2;
        return !reduced && !lowPower;
    }, []);

    if (!supported) return null;

    return (
        <div className="auth-scene" aria-hidden="true">
            <SceneBoundary>
                <Canvas
                    dpr={[1, 1.75]}
                    camera={{ position: [0, 0, 8], fov: 45 }}
                    gl={{ antialias: true, alpha: true }}
                    frameloop={animate ? 'always' : 'demand'}
                >
                    <Graph animate={animate} />
                </Canvas>
            </SceneBoundary>
        </div>
    );
}
