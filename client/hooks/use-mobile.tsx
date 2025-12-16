import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    if (screen.orientation) {
      screen.orientation.addEventListener("change", onChange);
    }
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      if (screen.orientation) {
        screen.orientation.removeEventListener("change", onChange);
      }
    };
  }, []);

  return !!isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(false);

  React.useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
    };
    
    window.addEventListener("resize", checkTablet);
    window.addEventListener("orientationchange", checkTablet);
    if (screen.orientation) {
      screen.orientation.addEventListener("change", checkTablet);
    }
    checkTablet();
    
    return () => {
      window.removeEventListener("resize", checkTablet);
      window.removeEventListener("orientationchange", checkTablet);
      if (screen.orientation) {
        screen.orientation.removeEventListener("change", checkTablet);
      }
    };
  }, []);

  return isTablet;
}

export function useViewportSize() {
  const [size, setSize] = React.useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    
    const updateSize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    const handleResize = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(updateSize);
      }, 50);
    };
    
    const handleOrientationChange = () => {
      setTimeout(() => {
        rafId = requestAnimationFrame(updateSize);
      }, 150);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);
    
    if (screen.orientation) {
      screen.orientation.addEventListener("change", handleOrientationChange);
    }
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }
    
    updateSize();
    
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
      if (screen.orientation) {
        screen.orientation.removeEventListener("change", handleOrientationChange);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return size;
}

export function useOrientation() {
  const [orientation, setOrientation] = React.useState<"portrait" | "landscape">(
    typeof window !== "undefined" 
      ? window.innerHeight > window.innerWidth ? "portrait" : "landscape"
      : "portrait"
  );

  React.useEffect(() => {
    const updateOrientation = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? "portrait" : "landscape"
      );
    };
    
    const handleOrientationChange = () => {
      setTimeout(updateOrientation, 150);
    };

    window.addEventListener("resize", handleOrientationChange);
    window.addEventListener("orientationchange", handleOrientationChange);
    
    if (screen.orientation) {
      screen.orientation.addEventListener("change", handleOrientationChange);
    }
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleOrientationChange);
    }
    
    return () => {
      window.removeEventListener("resize", handleOrientationChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
      if (screen.orientation) {
        screen.orientation.removeEventListener("change", handleOrientationChange);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleOrientationChange);
      }
    };
  }, []);

  return orientation;
}
