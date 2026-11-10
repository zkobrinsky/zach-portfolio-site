"use client";

import { useEffect } from "react";
import { APPROACH_EASES, shipApproach, shipHatch, shipHatchPath, shipLight, shipPlacement } from "@/lib/space/ship";

/** Dev-only sliders for placing the spaceship. Open the site with ?gui to see them. */
export function ShipGui() {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("gui")) return;
    let closed = false;
    let dispose = () => {};
    void import("lil-gui").then(({ default: GUI }) => {
      if (closed) return;
      const gui = new GUI({ title: "Spaceship" });
      const place = gui.addFolder("Position");
      place.add(shipPlacement, "start", 0, Math.PI * 2, 0.01).name("orbit angle");
      place.add(shipPlacement, "radius", 1.5, 6, 0.01).name("distance");
      place.add(shipPlacement, "lean", -1.5, 1.5, 0.01).name("orbit lean");
      const turn = gui.addFolder("Attitude");
      turn.add(shipPlacement, "pitch", -Math.PI, Math.PI, 0.01);
      turn.add(shipPlacement, "yaw", -Math.PI, Math.PI, 0.01);
      turn.add(shipPlacement, "roll", -Math.PI, Math.PI, 0.01);
      turn.add(shipPlacement, "scale", 0.2, 4, 0.01);
      const light = gui.addFolder("Light");
      light.add(shipLight, "fill", 0, 1, 0.01).name("shadow fill");
      light.add(shipLight, "side", 0, 3, 0.01).name("side light");
      light.add(shipLight, "front", -0.8, 0.8, 0.01).name("light angle");
      const approach = gui.addFolder("Flight to ship");
      approach.add(shipApproach, "ease", Object.keys(APPROACH_EASES));
      approach.add(shipApproach, "seconds", 1, 8, 0.1);
      approach.add(shipApproach, "fadeStart", 0.5, 1, 0.01).name("white-out at");
      approach.add(shipApproach, "hatchOpensAt", 0, 1, 0.01).name("ramp drops at");
      approach.add(shipApproach, "hatchOpenBy", 0, 1, 0.01).name("ramp down by");
      approach.add(shipHatchPath, "runIn", 0, 15, 0.1).name("lines up ahead");
      approach.add(shipHatchPath, "runBelow", -1, 4, 0.05).name("lines up below");
      approach.add(shipHatchPath, "endBelow", -0.5, 2, 0.01).name("ends below");
      const hatch = gui.addFolder("Ramp");
      hatch.add(shipHatch, "preview", 0, 1, 0.01).name("open (preview)");
      hatch.add(shipHatch, "x", -8, 10, 0.05);
      hatch.add(shipHatch, "y", -3, 1, 0.01);
      hatch.add(shipHatch, "z", -3, 3, 0.05);
      hatch.add(shipHatch, "length", 0.5, 8, 0.05);
      hatch.add(shipHatch, "width", 0.5, 6, 0.05);
      hatch.add(shipHatch, "depth", 0.05, 2, 0.01).name("cut depth");
      hatch.add(shipHatch, "angle", 0.3, 3, 0.01).name("drop angle");
      hatch.add(shipHatch, "glow", 1, 12, 0.1);
      hatch.add(shipHatch, "beam", 0, 1, 0.01).name("light beam");
      hatch.add(shipHatch, "light", 0, 0.2, 0.001).name("light on hull");
      const copy = {
        "copy values": () => {
          const values = Object.entries({ ...shipPlacement, ...shipLight, ...shipApproach, ...shipHatch, ...shipHatchPath }).map(
            ([key, value]) => `${key}: ${typeof value === "number" ? value.toFixed(2) : value}`,
          );
          void navigator.clipboard.writeText(`ship placement: ${values.join(", ")}`);
        },
      };
      gui.add(copy, "copy values");
      dispose = () => gui.destroy();
    });
    return () => {
      closed = true;
      dispose();
    };
  }, []);

  return null;
}
