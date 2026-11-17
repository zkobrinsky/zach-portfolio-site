"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches anything that breaks the 3D scene (a file that fails to download, the scene's code failing to load)
 * so it doesn't take the whole site down with it. Renders nothing once it has caught something.
 */
export class SceneErrorBoundary extends Component<
  { onError: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("The 3D scene failed to load:", error);
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
