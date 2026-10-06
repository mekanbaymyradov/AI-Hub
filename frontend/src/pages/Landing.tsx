import { AuroraFlow } from "../../components/ui/aurora-flow";
import HeroGeometric from "../../components/ui/hero-geometric";


export default function Landing() {
  return (
    <div >
      <AuroraFlow
        preset="ocean"
        colors={["#020817", "#062a55", "#0b62b4", "#39bfe6", "#d9f6ff"]}
        speed={1}
        intensity={1}
        opacity={1}
        blur={1}
        contrast={1.04}
        brightness={1}
        grain={true}
        grainOpacity={0.22}
        layers={6}
        flowScale={1}
        flowStrength={1}
        flowDirection={-18}
        animationSpeed={1}
        pointerInteraction={true}
        pointerStrength={0.7}
        scrollInteraction={false}
        parallaxStrength={0.5}
        lighting={true}
        lightingIntensity={0.8}
        lightingRadius={1}
        lightingSpeed={0.8}
        ambientGlow={true}
        ambientOpacity={0.7}
        noise={true}
        noiseOpacity={0.16}
        noiseScale={1}
        vignette={true}
        vignetteStrength={0.55}
        borderRadius="0px"
        className="min-h-[560px]"
      />



      <HeroGeometric
        title1="Elevate"
        title2="Your Brand"
        description="Scale your product with clarity, precision, and motion-led design."
        color1="#3B82F6"
        color2="#F0F9FF"
        speed={1}
      />
    </div>
  );
}




