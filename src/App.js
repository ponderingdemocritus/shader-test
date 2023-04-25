import "./styles.css";
import { Canvas } from "@react-three/fiber";
import {
  Billboard,
  Environment,
  OrbitControls,
  PerspectiveCamera,
  Plane,
  Sphere,
  useGLTF
} from "@react-three/drei";
import { Floor } from "./components/Floor";
import Lights from "./components/Lights";
import { Suspense, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import CSM from "three-custom-shader-material/vanilla";
import { button, useControls, folder, Leva } from "leva";
import { Copy } from "./Copy";
import Model from "./RealmCity_exportTest_7";
import { EffectComposer, DepthOfField, Bloom, Noise, Vignette, Outline, EffectComposerContext } from '@react-three/postprocessing'
import { HatchMaterial, SobelEffect } from "./effects";
import { wrapEffect } from "./utils";
export class ToonMaterial extends CSM {
  constructor() {
    super({
      baseMaterial: THREE.MeshStandardMaterial,
      uniforms: {
        uRamp: {
          value: null
        }
      },
      fragmentShader: /* glsl */ `
      uniform sampler2D uRamp;

      float luma(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }

      vec3 colorRamp(float t, sampler2D ramp) {
        vec2 uv = vec2(t, 0.0);
        vec3 col = texture2D(ramp, uv).rgb;
        return col;
      }


      vec3 getToonColor(vec3 diffuse) {
        float factor = luma(diffuse);
        factor = clamp(factor, 0.0, 1.0);

        vec3 color = colorRamp(factor, uRamp);
        return color;
      }
    `,
      patchMap: {
        "*": {
          "#include <output_fragment>": `
          #include <output_fragment>
          gl_FragColor = vec4( getToonColor(outgoingLight), diffuseColor.a );
        `
        }
      },
      envMapIntensity: 0.4
    });
  }

  set uRamp(steps) {
    this.uniforms.uRamp.value = this.getConstantRamp(steps);
  }

  get uRamp() {
    return this.uniforms.uRamp.value;
  }

  getConstantRamp(stops) {
    const arr = [];
    const color = new THREE.Color();

    // Sort the stops by position
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);

    for (let i = 0; i < 1; i++) {
      for (let j = 0; j < 256; j++) {
        let position = j / 256;
        let stopIndex;

        for (stopIndex = 0; stopIndex < sorted.length - 1; stopIndex++) {
          if (sorted[stopIndex].pos <= position && sorted[stopIndex + 1].pos > position) {
            break;
          }
        }

        let lowerStop = sorted[stopIndex];
        let upperStop = sorted[stopIndex + 1] || lowerStop;
        let t = (position - lowerStop.pos) / (upperStop.pos - lowerStop.pos);

        color.set(lowerStop.color);
        const lowerColor = color.clone();
        color.set(upperStop.color);
        const upperColor = color.clone();

        color.copy(lowerColor).lerp(upperColor, t);
        arr.push(color.r * 255, color.g * 255, color.b * 255, 255);
      }
    }

    const texture = new THREE.DataTexture(
      new Uint8Array(arr), //
      256,
      1
    );
    texture.needsUpdate = true;
    return texture;
  }
}

function Thing() {
  const { scene } = useGLTF("/monkeys.glb");
  const material = useMemo(() => new ToonMaterial(), []);

  const [steps, setSteps] = useState([
    { color: "#344541", pos: 0 },
    { color: "#38574d", pos: 0.1 },
    { color: "#7FAE58", pos: 0.36 },
    { color: "#CDE583", pos: 0.82 }
  ]);

  useEffect(() => {
    material.uRamp = steps;
  }, [material, steps]);

  useControls(() => {
    const obj = {};

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      obj[`Step-${i}`] = folder({
        [`position-${i}`]: {
          value: step.pos,
          min: 0,
          max: 1,
          step: 0.001,
          onChange: (v) => {
            setSteps((s) => {
              const clone = [...s];
              clone[i].pos = v;
              return clone;
            });
          }
        },
        [`color-${i}`]: {
          value: step.color,
          onChange: (col) => {
            setSteps((s) => {
              const clone = [...s];
              clone[i].color = col;
              return clone;
            });
          }
        }
      });
    }

    return obj;
  }, []);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = material;
      }
    });

    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <>
      <Billboard>
        <Plane position={[0, 2, 0]}>
          <meshBasicMaterial map={material.uRamp} />
        </Plane>
      </Billboard>
      <primitive object={scene} />;
    </>
  );
}

const Sobel = wrapEffect(SobelEffect)


export default function App() {


  return (
    <>
      <Canvas gl={{
        powerPreference: "high-performance",
        alpha: false,
        antialias: true,
        stencil: false,
        depth: false
      }} shadows>
        <directionalLight position={[5, 5, -8]} castShadow intensity={5} shadow-mapSize={2048} shadow-bias={-0.001}>


          {/* <rectAreaLight
          width={100}
          height={100}
          intensity={1000}
          color={"#ffffff"}
          position={[180, 180, 180]}
          lookAt={[0, 0, 0]}
          penumbra={2}
          castShadow
        /> */}
          <fog attach="fog" args={[0xffffff, 10, 90]} />

          <OrbitControls makeDefault />
          <PerspectiveCamera fov={39.6} position={[50, 50, 10]} makeDefault />

          <Suspense>
            <Model />
            {/* <Thing /> */}
            <Environment
              background
              blur={0.05}
              files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/table_mountain_2_puresky_1k.hdr"
            />
          </Suspense>
          <EffectComposer>

            {/* <Outline visibleEdgeColor={"blue"} width={500} edgeStrength={100} /> */}
            <DepthOfField focusDistance={0} focalLength={1} bokehScale={2} height={480} />
            <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} height={100} />
            <Noise opacity={0.01} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
            <Sobel />
            {/* <Pixelation granularity={16} /> */}
          </EffectComposer>
        </directionalLight>
      </Canvas>

      {/* <Leva collapsed /> */}
      <Copy />
    </>
  );
}
