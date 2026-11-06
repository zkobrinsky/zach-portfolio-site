"use client";

import { useEffect } from "react";
import { shipLight, shipPlacement } from "@/lib/space/ship";

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
      const copy = {
        "copy values": () => {
          const values = Object.entries({ ...shipPlacement, ...shipLight }).map(([key, value]) => `${key}: ${value.toFixed(2)}`);
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
