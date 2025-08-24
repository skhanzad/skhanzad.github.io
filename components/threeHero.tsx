"use client"
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeHero() {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.z = 5;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0); // Transparent background
        rendererRef.current = renderer;

        // Add renderer to DOM
        mountRef.current.appendChild(renderer.domElement);

        // Create geometry
        const geometry = new THREE.BoxGeometry(10, 10, 10);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x8b5cf6, // Purple color to match your theme
            wireframe: true 
        });

        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        // Add some ambient lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Animation loop
        const animate = () => {
            animationRef.current = requestAnimationFrame(animate);
            
            cube.rotation.x += 0.001;
            cube.rotation.y += 0.001;
            
            renderer.render(scene, camera);
        };

        animate();

        // Handle window resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener('resize', handleResize);

        // Cleanup function
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div 
            ref={mountRef} 
            className="absolute inset-0 pointer-events-none z-[-10]"
            style={{ zIndex: 0 }}
        />
    );
}