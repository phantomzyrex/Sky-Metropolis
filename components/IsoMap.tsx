/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { MapControls, Environment, SoftShadows, Instance, Instances, Float, useTexture, Outlines, OrthographicCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { Grid, BuildingType, TileData, WeatherType } from '../types';
import { GRID_SIZE, BUILDINGS } from '../constants';
import { getWeatherForDay } from '../utils/weather';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

// --- Constants & Helpers ---
const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];

// Deterministic random based on coordinates
const getHash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
const getRandomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Shared Geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);

// Shared Dynamic Materials for Day / Night Transitions
const windowMaterial = new THREE.MeshStandardMaterial({
  color: "#bfdbfe",
  emissive: "#bfdbfe",
  emissiveIntensity: 0.2,
  roughness: 0.1,
  metalness: 0.8
});

const waterMaterial = new THREE.MeshStandardMaterial({
  color: "#3b82f6",
  roughness: 0.1,
  metalness: 0.5,
  opacity: 0.85,
  transparent: true
});

const cloudMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  flatShading: true,
  opacity: 0.9,
  transparent: true
});

// --- 1. Advanced Procedural Buildings ---

// FIX: Wrap component in React.memo to ensure TypeScript recognizes it as a component that accepts a 'key' prop.
const WindowBlock = React.memo(({ position, scale }: { position: [number, number, number], scale: [number, number, number] }) => (
  <mesh geometry={boxGeo} position={position} scale={scale} material={windowMaterial} />
));

const SmokeStack = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.children.forEach((child, i) => {
        const cloud = child as THREE.Mesh;
        cloud.position.y += 0.01 + i * 0.005;
        cloud.scale.addScalar(0.005);
        
        const material = cloud.material as THREE.MeshStandardMaterial;
        if (material) {
          material.opacity -= 0.005;
          if (cloud.position.y > 1.5) {
            cloud.position.y = 0;
            cloud.scale.setScalar(0.1 + Math.random() * 0.1);
            material.opacity = 0.6;
          }
        }
      });
    }
  });

  return (
    <group position={position}>
      <mesh geometry={cylinderGeo} castShadow receiveShadow position={[0, 0.5, 0]} scale={[0.2, 1, 0.2]}>
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <group ref={ref} position={[0, 1, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} geometry={sphereGeo} position={[Math.random()*0.1, i*0.4, Math.random()*0.1]} scale={0.2}>
            <meshStandardMaterial color="#d1d5db" transparent opacity={0.6} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
};

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  opacity?: number;
  transparent?: boolean;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, opacity = 1, transparent = false }: BuildingMeshProps) => {
  const hash = getHash(x, y);
  const variant = Math.floor(hash * 100); // 0-99
  const rotation = Math.floor(hash * 4) * (Math.PI / 2);
  
  // Color variation
  const color = useMemo(() => {
    const c = new THREE.Color(baseColor);
    // Shift hue and lightness slightly based on hash
    c.offsetHSL(hash * 0.1 - 0.05, 0, hash * 0.2 - 0.1);
    return c;
  }, [baseColor, hash]);

  const mainMat = useMemo(() => new THREE.MeshStandardMaterial({ color, flatShading: true, opacity, transparent, roughness: 0.8 }), [color, opacity, transparent]);
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), flatShading: true, opacity, transparent }), [color, opacity, transparent]);
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.5).offsetHSL(0,0,-0.1), flatShading: true, opacity, transparent }), [color, opacity, transparent]);

  const commonProps = { castShadow: true, receiveShadow: true };

  // Buildings are built assuming y=0 is ground level within their group
  // Adjust vertical position to sit on top of ground tile (approx -0.3)
  const yOffset = -0.3;

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        switch (type) {
          case BuildingType.Residential:
            if (variant < 33) {
              // Cozy Cottage
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={coneGeo} position={[0, 0.75, 0]} scale={[0.6, 0.4, 0.6]} rotation={[0, Math.PI/4, 0]} />
                  <WindowBlock position={[0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                  <WindowBlock position={[-0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.1, 0.32]} scale={[0.15, 0.2, 0.05]} />
                </>
              );
            } else if (variant < 66) {
              // Modern Boxy
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.1, 0.35, 0]} scale={[0.6, 0.7, 0.8]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.25, 0.25, 0.1]} scale={[0.4, 0.5, 0.6]} />
                  <WindowBlock position={[-0.1, 0.5, 0.41]} scale={[0.4, 0.2, 0.05]} />
                </>
              );
            } else {
              // Townhouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[0.5, 1, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0, 1.05, 0]} scale={[0.55, 0.1, 0.65]} />
                  <WindowBlock position={[0, 0.7, 0.31]} scale={[0.3, 0.2, 0.05]} />
                  <WindowBlock position={[0, 0.3, 0.31]} scale={[0.3, 0.2, 0.05]} />
                </>
              );
            }

          case BuildingType.Commercial:
            if (variant < 40) {
              // High-rise
              const height = 1.5 + hash * 1.5;
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, height/2, 0]} scale={[0.7, height, 0.7]} />
                  {Array.from({ length: Math.floor(height * 3) }).map((_, i) => (
                    <WindowBlock key={i} position={[0, 0.2 + i * 0.3, 0]} scale={[0.72, 0.15, 0.72]} />
                  ))}
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, height + 0.1, 0]} scale={[0.5, 0.2, 0.5]} />
                </>
              );
            } else if (variant < 70) {
              // Shop
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <WindowBlock position={[0, 0.3, 0.41]} scale={[0.8, 0.4, 0.05]} />
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({ color: hash > 0.5 ? '#ef4444' : '#3b82f6' })} geometry={boxGeo} position={[0, 0.55, 0.5]} scale={[0.9, 0.1, 0.2]} rotation={[Math.PI/6, 0, 0]} />
                </>
              );
            } else {
              // Corner store
               return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.5, -0.2]} scale={[0.5, 1, 0.5]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.1, 0.3, 0.1]} scale={[0.7, 0.6, 0.7]} />
                  <WindowBlock position={[0.1, 0.3, 0.46]} scale={[0.6, 0.3, 0.05]} />
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#9ca3af'})} geometry={boxGeo} position={[0.2, 0.65, 0.2]} scale={[0.2, 0.1, 0.2]} />
                </>
               )
            }

          case BuildingType.Industrial:
            if (variant < 50) {
              // Factory
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[-0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <SmokeStack position={[0.3, 0.4, 0.3]} />
                </>
              );
            } else {
              // Warehouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.3, 0]} scale={[0.5, 0.6, 0.9]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, -0.2]} scale={[0.2, 0.8, 0.2]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, 0.25]} scale={[0.2, 0.8, 0.2]} />
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#6b7280'})} geometry={boxGeo} position={[0.25, 0.7, 0]} scale={[0.05, 0.05, 0.5]} />
                </>
              );
            }

          case BuildingType.Park:
            const treeCount = 1 + Math.floor(hash * 3);
            const positions = [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]];
            
            return (
              <group position={[0, -yOffset - 0.29, 0]}> {/* Adjust park base to sit exactly on top of ground tile */}
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <planeGeometry args={[0.9, 0.9]} />
                    <meshStandardMaterial color="#86efac" />
                </mesh>
                
                {variant < 30 && (
                    <group position={[0,0.05,0]}>
                        <mesh material={new THREE.MeshStandardMaterial({color: '#cbd5e1'})} geometry={cylinderGeo} scale={[0.4, 0.1, 0.4]} castShadow receiveShadow />
                        <mesh material={new THREE.MeshStandardMaterial({color: '#3b82f6', roughness: 0.1})} geometry={cylinderGeo} position={[0, 0.06, 0]} scale={[0.3, 0.05, 0.3]} />
                    </group>
                )}

                {Array.from({length: treeCount}).map((_, i) => {
                    const pos = positions[i % positions.length];
                    const scale = 0.5 + getHash(x+i, y-i) * 0.5;
                    const treeColor = new THREE.Color("#166534").offsetHSL(0, 0, getHash(x,y+i)*0.2);
                    return (
                    <group key={i} position={[pos[0], 0, pos[1]]} scale={scale} rotation={[0, getHash(i,x)*Math.PI, 0]}>
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: '#78350f' })} geometry={cylinderGeo} position={[0, 0.15, 0]} scale={[0.1, 0.3, 0.1]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.4, 0]} scale={[0.4, 0.5, 0.4]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.65, 0]} scale={[0.3, 0.4, 0.3]} />
                    </group>
                    )
                })}
              </group>
            );
          case BuildingType.Road:
             return null;
          default:
            return null;
        }
      })()}
    </group>
  );
});

// --- Growing Animation for newly placed buildings ---
interface PlacementRippleProps {
  color?: string;
}

const PlacementRipple = React.memo(({ color = '#38bdf8' }: PlacementRippleProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const [done, setDone] = useState(false);

  useFrame((_, delta) => {
    if (done || !meshRef.current) return;
    timeRef.current += delta;
    const duration = 0.45;
    const t = Math.min(1, timeRef.current / duration);

    // Subtle scale expansion from 0.45 to 1.15
    const s = 0.45 + t * 0.7;
    meshRef.current.scale.set(s, s, 1);

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    if (mat) {
      mat.opacity = Math.max(0, (1 - t) * 0.65);
    }

    if (t >= 1) {
      setDone(true);
    }
  });

  if (done) return null;

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={() => null}>
      <ringGeometry args={[0.3, 0.45, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
});

interface GrowingBuildingProps {
  children: React.ReactNode;
  rippleColor?: string;
  isNew?: boolean;
}

const GrowingBuilding = React.memo(({ children, rippleColor = '#38bdf8', isNew = true }: GrowingBuildingProps) => {
  const animGroupRef = useRef<THREE.Group>(null);
  const [animating, setAnimating] = useState(isNew);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!animating || !animGroupRef.current) return;

    timeRef.current += delta;
    const duration = 0.45; // 450ms smooth pop and settle
    const t = Math.min(1, timeRef.current / duration);

    // Dynamic ease-out overshoot (back easing)
    const p = t - 1;
    // Y (height) overshoot: pops up slightly taller (1.08) then settles
    const sY = 1.65;
    const easeOutY = 1 + (sY + 1) * p * p * p + sY * p * p;
    const scaleY = Math.max(0.001, easeOutY);

    // X and Z (footprint) expands smoothly with a softer overshoot (1.04)
    const sXZ = 1.15;
    const easeOutXZ = 1 + (sXZ + 1) * p * p * p + sXZ * p * p;
    const scaleXZ = Math.max(0.001, easeOutXZ);

    animGroupRef.current.scale.set(scaleXZ, scaleY, scaleXZ);

    if (t >= 1) {
      animGroupRef.current.scale.set(1, 1, 1);
      setAnimating(false);
    }
  });

  return (
    <group>
      {animating && <PlacementRipple color={rippleColor} />}
      <group ref={animGroupRef} scale={isNew ? [0.001, 0.001, 0.001] : [1, 1, 1]}>
        {/* Offset back up by 0.3 to counteract ProceduralBuilding's internal yOffset=-0.3, ensuring pivot is exactly at ground level */}
        <group position={[0, 0.3, 0]}>
          {children}
        </group>
      </group>
    </group>
  );
});

// --- 2. Dynamic Systems (Traffic, Citizens, Environment) ---

const carColors = ['#ef4444', '#3b82f6', '#eab308', '#ffffff', '#1f2937', '#f97316'];

const TrafficSystem = ({ grid }: { grid: Grid }) => {
  const roadTiles = useMemo(() => {
    const roads: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      if (tile.buildingType === BuildingType.Road) roads.push({x: tile.x, y: tile.y});
    }));
    return roads;
  }, [grid]);

  const carCount = Math.min(roadTiles.length, 30);
  const carsRef = useRef<THREE.InstancedMesh>(null);
  const carsState = useRef<Float32Array>(new Float32Array(0)); 
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => new Float32Array(0), []);

  useEffect(() => {
    if (roadTiles.length < 2) return;
    carsState.current = new Float32Array(carCount * 6);
    const newColors = new Float32Array(carCount * 3);

    for (let i = 0; i < carCount; i++) {
      const startNode = roadTiles[Math.floor(Math.random() * roadTiles.length)];
      carsState.current[i*6 + 0] = startNode.x;
      carsState.current[i*6 + 1] = startNode.y;
      carsState.current[i*6 + 2] = startNode.x;
      carsState.current[i*6 + 3] = startNode.y;
      carsState.current[i*6 + 4] = 1; // force pick new target
      carsState.current[i*6 + 5] = getRandomRange(0.01, 0.03); // speed

      const color = new THREE.Color(carColors[Math.floor(Math.random() * carColors.length)]);
      newColors[i*3] = color.r; newColors[i*3+1] = color.g; newColors[i*3+2] = color.b;
    }

    if (carsRef.current) {
        carsRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
    }
  }, [roadTiles, carCount]);

  useFrame(() => {
    if (!carsRef.current || roadTiles.length < 2 || carsState.current.length === 0) return;

    for (let i = 0; i < carCount; i++) {
      const idx = i * 6;
      let curX = carsState.current[idx];
      let curY = carsState.current[idx+1];
      let tarX = carsState.current[idx+2];
      let tarY = carsState.current[idx+3];
      let progress = carsState.current[idx+4];
      const speed = carsState.current[idx+5];

      progress += speed;

      if (progress >= 1) {
        curX = tarX;
        curY = tarY;
        progress = 0;
        
        const neighbors = roadTiles.filter(t => 
          (Math.abs(t.x - curX) === 1 && t.y === curY) || 
          (Math.abs(t.y - curY) === 1 && t.x === curX)
        );

        if (neighbors.length > 0) {
            // Simple pathfinding: avoid going back immediately
            const valid = neighbors.length > 1 
                ? neighbors.filter(n => Math.abs(n.x - carsState.current[idx]) > 0.1 || Math.abs(n.y - carsState.current[idx+1]) > 0.1)
                : neighbors;
            
            const next = valid.length > 0 
                ? valid[Math.floor(Math.random() * valid.length)]
                : neighbors[0];
            
            tarX = next.x;
            tarY = next.y;
        } else {
            const rnd = roadTiles[Math.floor(Math.random() * roadTiles.length)];
            curX = rnd.x; curY = rnd.y; tarX = rnd.x; tarY = rnd.y;
        }
      }

      carsState.current[idx] = curX;
      carsState.current[idx+1] = curY;
      carsState.current[idx+2] = tarX;
      carsState.current[idx+3] = tarY;
      carsState.current[idx+4] = progress;

      // Interpolate position
      const gx = MathUtils.lerp(curX, tarX, progress);
      const gy = MathUtils.lerp(curY, tarY, progress);

      // Determine driving side offset
      const dx = tarX - curX;
      const dy = tarY - curY;
      const angle = Math.atan2(dy, dx);
      
      // Offset to right side relative to movement
      const offsetAmt = 0.15;
      // Normals: (-dy, dx)
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const offX = (-dy/len) * offsetAmt;
      const offY = (dx/len) * offsetAmt;

      const [wx, _, wz] = gridToWorld(gx + offX, gy + offY);

      // Road surface is approx -0.3. Car height 0.15.
      dummy.position.set(wx, -0.3 + 0.075, wz);
      dummy.rotation.set(0, -angle, 0);
      // Car dimensions (Length(X), Height(Y), Width(Z) assuming 0 rotation aligns with X)
      dummy.scale.set(0.5, 0.15, 0.3); 
      
      dummy.updateMatrix();
      carsRef.current.setMatrixAt(i, dummy.matrix);
    }
    carsRef.current.instanceMatrix.needsUpdate = true;
  });

  if (roadTiles.length < 2) return null;

  return (
    <instancedMesh ref={carsRef} args={[boxGeo, undefined, carCount]} castShadow>
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
};

const clothesColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff'];

const PopulationSystem = ({ population, grid }: { population: number, grid: Grid }) => {
    const agentCount = Math.min(Math.floor(population / 2), 300); 
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    // Find tiles where people can walk (Roads, Parks, empty ground)
    const walkableTiles = useMemo(() => {
        const tiles: {x: number, y: number}[] = [];
        grid.forEach(row => row.forEach(tile => {
          if (tile.buildingType === BuildingType.Road || tile.buildingType === BuildingType.Park || tile.buildingType === BuildingType.None) {
            tiles.push({x: tile.x, y: tile.y});
          }
        }));
        return tiles;
    }, [grid]);
    
    const agentsState = useRef<Float32Array>(new Float32Array(0));
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    useEffect(() => {
        if (agentCount === 0 || walkableTiles.length === 0) return;
        agentsState.current = new Float32Array(agentCount * 6);
        const newColors = new Float32Array(agentCount * 3);

        for(let i=0; i<agentCount; i++) {
            const t = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            // Spawn with random offset in tile
            const x = t.x + getRandomRange(-0.4, 0.4);
            const y = t.y + getRandomRange(-0.4, 0.4);

            agentsState.current[i*6+0] = x;
            agentsState.current[i*6+1] = y;
            
            // Initial target
            const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            agentsState.current[i*6+2] = tt.x + getRandomRange(-0.4, 0.4);
            agentsState.current[i*6+3] = tt.y + getRandomRange(-0.4, 0.4);
            
            agentsState.current[i*6+4] = getRandomRange(0.005, 0.015); // speed
            agentsState.current[i*6+5] = Math.random() * Math.PI * 2; // anim

            const c = new THREE.Color(clothesColors[Math.floor(Math.random() * clothesColors.length)]);
            newColors[i*3] = c.r; newColors[i*3+1] = c.g; newColors[i*3+2] = c.b;
        }

        if (meshRef.current) {
            meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
        }
    }, [agentCount, walkableTiles]);

    useFrame((state) => {
        if (!meshRef.current || agentCount === 0 || agentsState.current.length === 0) return;
        const time = state.clock.elapsedTime;

        for(let i=0; i<agentCount; i++) {
            const idx = i*6;
            let x = agentsState.current[idx];
            let y = agentsState.current[idx+1];
            let tx = agentsState.current[idx+2];
            let ty = agentsState.current[idx+3];
            const speed = agentsState.current[idx+4];
            const animOffset = agentsState.current[idx+5];

            const dx = tx - x;
            const dy = ty - y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 0.1) {
                // Pick new random target from walkable
                if (walkableTiles.length > 0) {
                    const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
                    tx = tt.x + getRandomRange(-0.4, 0.4);
                    ty = tt.y + getRandomRange(-0.4, 0.4);
                    agentsState.current[idx+2] = tx;
                    agentsState.current[idx+3] = ty;
                }
            } else {
                x += (dx/dist) * speed;
                y += (dy/dist) * speed;
                agentsState.current[idx] = x;
                agentsState.current[idx+1] = y;
            }

            const [wx, _, wz] = gridToWorld(x, y);

            // Walking bounce
            const bounce = Math.abs(Math.sin(time * 10 + animOffset)) * 0.03;

            // Person dimensions
            const height = 0.2;
            const width = 0.08;
            // Ground level approx -0.3 to -0.4
            const groundY = -0.35; 

            dummy.position.set(wx, groundY + height/2 + bounce, wz);
            dummy.rotation.set(0, -Math.atan2(dy, dx), 0);
            dummy.scale.set(width, height, width);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (agentCount === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[boxGeo, undefined, agentCount]} castShadow>
            <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
    )
};

// Clouds & Birds
const Cloud = ({ position, scale, speed }: { position: [number, number, number], scale: number, speed: number }) => {
    const group = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (group.current) {
            group.current.position.x += speed * delta;
            if (group.current.position.x > GRID_SIZE * 1.5) group.current.position.x = -GRID_SIZE * 1.5;
        }
    });

    const bubbles = useMemo(() => Array.from({length: 5 + Math.random() * 5}).map(() => ({
        pos: [getRandomRange(-1,1), getRandomRange(-0.5, 0.5), getRandomRange(-1,1)] as [number, number, number],
        scale: getRandomRange(0.5, 1.2)
    })), []);

    return (
        <group ref={group} position={position} scale={scale}>
            {bubbles.map((b, i) => (
                <mesh key={i} geometry={sphereGeo} position={b.pos} scale={b.scale} castShadow material={cloudMaterial} />
            ))}
        </group>
    )
}

const Bird = ({ position, speed, offset }: { position: [number, number, number], speed: number, offset: number }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(ref.current) {
            const time = state.clock.elapsedTime + offset;
            ref.current.position.x = position[0] + Math.sin(time * speed) * GRID_SIZE;
            ref.current.position.z = position[1] + Math.cos(time * speed) * GRID_SIZE/2;
            ref.current.rotation.y = -time * speed + Math.PI;
            ref.current.scale.y = 1 + Math.sin(time * 15) * 0.3;
        }
    });

    return (
        <group ref={ref} position={[position[0], position[2], position[1]]}>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[0.1,0,0]} rotation={[0, Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[-0.1,0,0]} rotation={[0, -Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
        </group>
    )
}

// --- 3D Weather Particle Systems ---
const RainParticles = React.memo(({ count = 750 }: { count?: number }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
      pos[i * 3 + 1] = getRandomRange(0, 16);
      pos[i * 3 + 2] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
      vel[i] = getRandomRange(14, 22);
    }
    return [pos, vel];
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame((_, delta) => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] -= velocities[i] * delta;
      array[i * 3] -= 3.5 * delta;

      if (array[i * 3 + 1] < -0.3) {
        array[i * 3 + 1] = 16;
        array[i * 3] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
        array[i * 3 + 2] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#bae6fd"
        size={0.14}
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </points>
  );
});

const SnowParticles = React.memo(({ count = 450 }: { count?: number }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, data] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const d = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
      pos[i * 3 + 1] = getRandomRange(0, 16);
      pos[i * 3 + 2] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
      d[i * 2] = getRandomRange(1.0, 2.4);
      d[i * 2 + 1] = getRandomRange(0, Math.PI * 2);
    }
    return [pos, d];
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame((state, delta) => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const speed = data[i * 2];
      const phase = data[i * 2 + 1];

      array[i * 3 + 1] -= speed * delta;
      array[i * 3] += Math.sin(time * 1.8 + phase) * 0.5 * delta;
      array[i * 3 + 2] += Math.cos(time * 1.2 + phase) * 0.5 * delta;

      if (array[i * 3 + 1] < -0.3) {
        array[i * 3 + 1] = 16;
        array[i * 3] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
        array[i * 3 + 2] = getRandomRange(-GRID_SIZE * 1.2, GRID_SIZE * 1.2);
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#ffffff"
        size={0.24}
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
});

const EnvironmentEffects = ({ nightFactor = 0, weather = 'clear' }: { nightFactor?: number; weather?: WeatherType }) => {
    return (
        <group raycast={() => null}>
            {/* 3D Weather Particle System */}
            {weather === 'rain' && <RainParticles />}
            {weather === 'snow' && <SnowParticles />}

            {/* Starlight during evening and night (hidden during rain) */}
            {nightFactor > 0.1 && weather !== 'rain' && (
                <group>
                    <Stars radius={55} depth={20} count={350} factor={3} saturation={0} fade speed={1} />
                </group>
            )}

            {/* Clouds */}
            <Cloud position={[-12, 8, 4]} scale={1.5} speed={0.3} />
            <Cloud position={[5, 9, -8]} scale={1.2} speed={0.5} />
            <Cloud position={[15, 7, 10]} scale={1.8} speed={0.2} />
            
            {/* Birds (active during clear daylight hours) */}
            {nightFactor < 0.6 && weather === 'clear' && (
                <group position={[0, 0, 0]} scale={0.8}>
                    <Bird position={[0, 0, 10]} speed={0.6} offset={0} />
                    <Bird position={[0, 0, 10]} speed={0.6} offset={1.2} />
                    <Bird position={[0, 0, 10]} speed={0.6} offset={2.5} />
                </group>
            )}

            {/* Dynamic Water reflecting sky & time of day */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow material={waterMaterial}>
                <planeGeometry args={[GRID_SIZE * 4, GRID_SIZE * 4]} />
            </mesh>
        </group>
    )
};


// --- 3. Main Map Component ---

const RoadMarkings = React.memo(({ x, y, grid, yOffset }: { x: number; y: number; grid: Grid; yOffset: number }) => {
  const lineMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbbf24' }), []);
  const lineGeo = useMemo(() => new THREE.PlaneGeometry(0.1, 0.5), []);

  const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
  const hasDown = y < GRID_SIZE - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
  const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
  const hasRight = x < GRID_SIZE - 1 && grid[y][x + 1].buildingType === BuildingType.Road;

  const connections = [hasUp, hasDown, hasLeft, hasRight].filter(Boolean).length;
  
  // Isolated road piece: draw a default line
  if (connections === 0) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]} geometry={lineGeo} material={lineMaterial} />
    );
  }

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
      {/* Center point for junctions to fill the gap, lifted slightly to avoid z-fighting */}
      {(hasUp || hasDown) && (hasLeft || hasRight) && (
        <mesh position={[0, 0, 0.005]} material={lineMaterial}>
           <planeGeometry args={[0.12, 0.12]} />
        </mesh>
      )}

      {hasUp && <mesh position={[0, 0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasDown && <mesh position={[0, -0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasLeft && <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
      {hasRight && <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
    </group>
  );
});

interface GroundTileProps {
    type: BuildingType;
    x: number;
    y: number;
    grid: Grid;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
}

// Ground Tile: Handles pointer events and forms base terrain
const GroundTile = React.memo(({ type, x, y, grid, onHover, onLeave, onClick }: GroundTileProps) => {
  const [wx, _, wz] = gridToWorld(x, y);
  
  let color = '#10b981';
  // Base level for tiles, slightly varying
  let topY = -0.3; 
  let thickness = 0.5;
  
  if (type === BuildingType.None) {
    const noise = getHash(x, y);
    color = noise > 0.7 ? '#059669' : noise > 0.3 ? '#10b981' : '#34d399';
    topY = -0.3 - noise * 0.1; // Slight height variation for grass
  } else if (type === BuildingType.Road) {
    color = '#374151';
    topY = -0.29; // slightly higher
  } else {
    color = '#d1d5db'; // concrete base
    topY = -0.28;
  }

  const centerY = topY - thickness/2;

  return (
    <mesh 
        position={[wx, centerY, wz]} 
        receiveShadow castShadow
        onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
        onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
        onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button === 0) onClick(x, y);
        }}
    >
      <boxGeometry args={[1, thickness, 1]} />
      <meshStandardMaterial color={color} flatShading roughness={1} />
      {type === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={thickness / 2 + 0.001} />}
    </mesh>
  );
});

// Selection/Hover Cursor
const Cursor = ({ x, y, color }: { x: number, y: number, color: string }) => {
  const [wx, _, wz] = gridToWorld(x, y);
  return (
    <mesh position={[wx, -0.25, wz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
      <Outlines thickness={0.05} color="white" />
    </mesh>
  );
};


// --- Day / Night Cycle Engine ---
const CYCLE_DAYS = 8;

interface DayNightKeyframe {
  t: number;
  skyColor: string;
  ambientColor: string;
  ambientIntensity: number;
  dirColor: string;
  dirIntensity: number;
  dirPos: [number, number, number];
  waterColor: string;
  cloudColor: string;
  nightFactor: number;
}

const KEYFRAMES: DayNightKeyframe[] = [
  {
    t: 0.10, // Dawn / Sunrise
    skyColor: '#0c4a6e', // rich indigo-dawn
    ambientColor: '#fed7aa', // warm peach morning ambient
    ambientIntensity: 0.38,
    dirColor: '#fb923c', // golden sunrise sun
    dirIntensity: 1.25,
    dirPos: [24, 10, 8],
    waterColor: '#0369a1',
    cloudColor: '#fed7aa',
    nightFactor: 0.15,
  },
  {
    t: 0.35, // High Noon / Full Bright Daylight
    skyColor: '#0284c7', // vibrant sky blue
    ambientColor: '#cceeff', // bright sky bounce
    ambientIntensity: 0.55,
    dirColor: '#fffbeb', // brilliant warm white sun
    dirIntensity: 2.1,
    dirPos: [15, 22, 10],
    waterColor: '#3b82f6',
    cloudColor: '#ffffff',
    nightFactor: 0.0,
  },
  {
    t: 0.62, // Sunset / Golden Dusk
    skyColor: '#581c87', // dramatic twilight purple/crimson
    ambientColor: '#fb923c', // warm orange horizon glow
    ambientIntensity: 0.40,
    dirColor: '#ea580c', // deep amber sunset light
    dirIntensity: 1.45,
    dirPos: [-22, 8, 14],
    waterColor: '#1e3a8a',
    cloudColor: '#f472b6',
    nightFactor: 0.35,
  },
  {
    t: 0.85, // Deep Night / Starlight
    skyColor: '#030712', // deep midnight obsidian
    ambientColor: '#1e1b4b', // starlight indigo
    ambientIntensity: 0.18,
    dirColor: '#93c5fd', // cool pale blue moonlight
    dirIntensity: 0.45,
    dirPos: [-12, 18, -10],
    waterColor: '#0a1122',
    cloudColor: '#334155',
    nightFactor: 1.0,
  },
];

const sampleDayNight = (t: number) => {
  const normT = ((t % 1) + 1) % 1;

  let idxA = KEYFRAMES.length - 1;
  let idxB = 0;

  for (let i = 0; i < KEYFRAMES.length; i++) {
    if (KEYFRAMES[i].t <= normT) {
      idxA = i;
      idxB = (i + 1) % KEYFRAMES.length;
    }
  }
  if (normT < KEYFRAMES[0].t) {
    idxA = KEYFRAMES.length - 1;
    idxB = 0;
  }

  const kfA = KEYFRAMES[idxA];
  const kfB = KEYFRAMES[idxB];

  let span = kfB.t - kfA.t;
  let dist = normT - kfA.t;
  if (span <= 0) span += 1;
  if (dist < 0) dist += 1;

  const alpha = Math.max(0, Math.min(1, dist / span));
  const smoothAlpha = THREE.MathUtils.smoothstep(alpha, 0, 1);

  const skyColor = new THREE.Color(kfA.skyColor).lerp(new THREE.Color(kfB.skyColor), smoothAlpha);
  const ambientColor = new THREE.Color(kfA.ambientColor).lerp(new THREE.Color(kfB.ambientColor), smoothAlpha);
  const ambientIntensity = THREE.MathUtils.lerp(kfA.ambientIntensity, kfB.ambientIntensity, smoothAlpha);
  const dirColor = new THREE.Color(kfA.dirColor).lerp(new THREE.Color(kfB.dirColor), smoothAlpha);
  const dirIntensity = THREE.MathUtils.lerp(kfA.dirIntensity, kfB.dirIntensity, smoothAlpha);
  const dirPos: [number, number, number] = [
    THREE.MathUtils.lerp(kfA.dirPos[0], kfB.dirPos[0], smoothAlpha),
    THREE.MathUtils.lerp(kfA.dirPos[1], kfB.dirPos[1], smoothAlpha),
    THREE.MathUtils.lerp(kfA.dirPos[2], kfB.dirPos[2], smoothAlpha),
  ];
  const waterColor = new THREE.Color(kfA.waterColor).lerp(new THREE.Color(kfB.waterColor), smoothAlpha);
  const cloudColor = new THREE.Color(kfA.cloudColor).lerp(new THREE.Color(kfB.cloudColor), smoothAlpha);
  const nightFactor = THREE.MathUtils.lerp(kfA.nightFactor, kfB.nightFactor, smoothAlpha);

  return {
    skyColor,
    ambientColor,
    ambientIntensity,
    dirColor,
    dirIntensity,
    dirPos,
    waterColor,
    cloudColor,
    nightFactor,
  };
};

interface DayNightControllerProps {
  day: number;
  weather?: WeatherType;
  onBgColorChange: (cssColor: string) => void;
  onNightFactorChange: (factor: number) => void;
}

const DayNightController = ({ day, weather = 'clear', onBgColorChange, onNightFactorChange }: DayNightControllerProps) => {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const smoothDayRef = useRef(day);

  useFrame((_, delta) => {
    // Continuously glide smoothDay towards target day across the tick rate
    smoothDayRef.current = THREE.MathUtils.damp(smoothDayRef.current, day, 1.8, delta);

    const t = ((smoothDayRef.current - 1) % CYCLE_DAYS + CYCLE_DAYS) % CYCLE_DAYS / CYCLE_DAYS;
    const current = sampleDayNight(t);

    // Weather adjustments to lighting & sky
    if (weather === 'rain') {
      current.skyColor.lerp(new THREE.Color('#334155'), 0.35); // overcast rainy sky
      current.cloudColor.set('#64748b'); // dark rain clouds
      current.ambientIntensity *= 0.85;
      current.dirIntensity *= 0.6; // softened diffused sunlight through storm clouds
    } else if (weather === 'snow') {
      current.cloudColor.set('#cbd5e1'); // frosty snow clouds
      current.ambientColor.lerp(new THREE.Color('#e0f2fe'), 0.25);
    }

    // 1. Update scene background
    scene.background = current.skyColor;
    onBgColorChange('#' + current.skyColor.getHexString());
    onNightFactorChange(current.nightFactor);

    // 2. Update ambient light
    if (ambientRef.current) {
      ambientRef.current.color.copy(current.ambientColor);
      ambientRef.current.intensity = current.ambientIntensity;
    }

    // 3. Update directional light (Sun / Moon)
    if (dirLightRef.current) {
      dirLightRef.current.color.copy(current.dirColor);
      dirLightRef.current.intensity = current.dirIntensity;
      dirLightRef.current.position.set(current.dirPos[0], current.dirPos[1], current.dirPos[2]);
    }

    // 4. Update dynamic materials
    waterMaterial.color.copy(current.waterColor);
    cloudMaterial.color.copy(current.cloudColor);

    // 5. Update windows (warm cozy glow at night, daylight reflection during day)
    const windowColor = new THREE.Color().lerpColors(
      new THREE.Color("#bfdbfe"),
      new THREE.Color("#fef08a"),
      current.nightFactor
    );
    windowMaterial.color.copy(windowColor);
    windowMaterial.emissive.copy(windowColor);
    windowMaterial.emissiveIntensity = 0.15 + current.nightFactor * 0.85;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.5} color="#cceeff" />
      <directionalLight
        ref={dirLightRef}
        castShadow
        position={[15, 20, 10]}
        intensity={2}
        color="#fffbeb"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
    </>
  );
};

interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  population: number;
  day?: number;
  weather?: WeatherType;
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, population, day = 1, weather }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);
  const [currentBgColor, setCurrentBgColor] = useState('#0c4a6e');
  const [nightFactor, setNightFactor] = useState(0);

  const currentWeather = weather || getWeatherForDay(day).type;

  const handleBgColorChange = useCallback((color: string) => {
    setCurrentBgColor(color);
  }, []);

  const handleNightFactorChange = useCallback((factor: number) => {
    setNightFactor(factor);
  }, []);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredTile(null);
  }, []);

  // Preview Logic
  const showPreview = hoveredTile && grid[hoveredTile.y][hoveredTile.x].buildingType === BuildingType.None && hoveredTool !== BuildingType.None;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const isBulldoze = hoveredTool === BuildingType.None;
  
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];

  return (
    <div 
      className="absolute inset-0 touch-none transition-colors duration-500 ease-out" 
      style={{ backgroundColor: currentBgColor }}
    >
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
        <OrthographicCamera makeDefault zoom={45} position={[20, 20, 20]} near={-100} far={200} />
        
        <MapControls 
          enableRotate={true}
          enableZoom={true}
          minZoom={20}
          maxZoom={120}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={0.1}
          target={[0,-0.5,0]}
        />

        <DayNightController 
          day={day} 
          weather={currentWeather}
          onBgColorChange={handleBgColorChange} 
          onNightFactorChange={handleNightFactorChange} 
        />
        <Environment preset="city" />

        <EnvironmentEffects nightFactor={nightFactor} weather={currentWeather} />

        <group>
          {grid.map((row, y) =>
            row.map((tile, x) => {
              // Calculate world position once per tile
              const [wx, _, wz] = gridToWorld(x, y);
              
              return (
              <React.Fragment key={`${x}-${y}`}>
                <GroundTile 
                    type={tile.buildingType} 
                    x={x} y={y} 
                    grid={grid}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onClick={onTileClick}
                />
                
                {/* Building visual - apply world position to group to align with ground tile */}
                <group position={[wx, -0.3, wz]} raycast={() => null}>
                    {tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
                      <GrowingBuilding 
                        key={`${tile.buildingType}-${tile.placedAt || `${x}-${y}`}`}
                        rippleColor={BUILDINGS[tile.buildingType].color}
                        isNew={true}
                      >
                        <ProceduralBuilding 
                          type={tile.buildingType} 
                          baseColor={BUILDINGS[tile.buildingType].color} 
                          x={x} y={y} 
                        />
                      </GrowingBuilding>
                    )}
                    {tile.buildingType === BuildingType.Road && tile.placedAt && (
                      <PlacementRipple key={`road-ripple-${tile.placedAt}`} color="#64748b" />
                    )}
                </group>
              </React.Fragment>
            )})
          )}

          {/* Visual Elements - disable pointer events */}
          <group raycast={() => null}>
            <TrafficSystem grid={grid} />
            <PopulationSystem population={population} grid={grid} />

            {/* Placement Preview */}
            {showPreview && hoveredTile && (
              <group position={[previewPos[0], 0, previewPos[2]]}>
                <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                  <ProceduralBuilding 
                    type={hoveredTool} 
                    baseColor={previewColor} 
                    x={hoveredTile.x} 
                    y={hoveredTile.y} 
                    transparent 
                    opacity={0.7} 
                  />
                </Float>
              </group>
            )}

            {/* Highlight */}
            {hoveredTile && (
              <Cursor 
                x={hoveredTile.x} 
                y={hoveredTile.y} 
                color={isBulldoze ? '#ef4444' : (showPreview ? '#ffffff' : '#000000')} 
              />
            )}
          </group>
        </group>
        
        <SoftShadows size={10} samples={8} />
      </Canvas>
    </div>
  );
};

export default IsoMap;