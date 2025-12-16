import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

function getViewportDimensions() {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }
  
  const vv = window.visualViewport;
  if (vv) {
    return { width: vv.width, height: vv.height };
  }
  
  const de = document.documentElement;
  if (de) {
    return { width: de.clientWidth, height: de.clientHeight };
  }
  
  return { width: window.innerWidth, height: window.innerHeight };
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = () => {
      setIsMobile(getViewportDimensions().width < MOBILE_BREAKPOINT);
    };
    
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    
    if (mql.addEventListener) {
      mql.addEventListener("change", handleMediaChange);
    } else if (mql.addListener) {
      mql.addListener(handleMediaChange);
    }
    
    window.addEventListener("resize", onChange);
    
    onChange();
    
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", handleMediaChange);
      } else if (mql.removeListener) {
        mql.removeListener(handleMediaChange);
      }
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return !!isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(false);

  React.useEffect(() => {
    const checkTablet = () => {
      const width = getViewportDimensions().width;
      setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
    };
    
    window.addEventListener("resize", checkTablet);
    checkTablet();
    
    return () => {
      window.removeEventListener("resize", checkTablet);
    };
  }, []);

  return isTablet;
}

export function useViewportSize() {
  const [size, setSize] = React.useState(getViewportDimensions);

  React.useEffect(() => {
    let rafId: number | null = null;
    
    const updateSize = () => {
      const newSize = getViewportDimensions();
      setSize(prev => {
        if (prev.width !== newSize.width || prev.height !== newSize.height) {
          return newSize;
        }
        return prev;
      });
    };
    
    const scheduleUpdate = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateSize);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });
    
    resizeObserver.observe(document.documentElement);
    
    const orientationMql = window.matchMedia("(orientation: portrait)");
    
    const handleOrientationChange = () => {
      setTimeout(scheduleUpdate, 100);
    };
    
    if (orientationMql.addEventListener) {
      orientationMql.addEventListener("change", handleOrientationChange);
    } else if (orientationMql.addListener) {
      orientationMql.addListener(handleOrientationChange);
    }
    
    window.addEventListener("resize", scheduleUpdate);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleUpdate);
    }
    
    updateSize();
    
    return () => {
      resizeObserver.disconnect();
      
      if (orientationMql.removeEventListener) {
        orientationMql.removeEventListener("change", handleOrientationChange);
      } else if (orientationMql.removeListener) {
        orientationMql.removeListener(handleOrientationChange);
      }
      
      window.removeEventListener("resize", scheduleUpdate);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", scheduleUpdate);
      }
      
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return size;
}

export function useOrientation() {
  const [orientation, setOrientation] = React.useState<"portrait" | "landscape">(() => {
    const { width, height } = getViewportDimensions();
    return height > width ? "portrait" : "landscape";
  });

  React.useEffect(() => {
    const updateOrientation = () => {
      const { width, height } = getViewportDimensions();
      setOrientation(height > width ? "portrait" : "landscape");
    };
    
    const scheduleUpdate = () => {
      setTimeout(updateOrientation, 100);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });
    
    resizeObserver.observe(document.documentElement);
    
    const orientationMql = window.matchMedia("(orientation: portrait)");
    
    const handleMediaChange = () => {
      scheduleUpdate();
    };
    
    if (orientationMql.addEventListener) {
      orientationMql.addEventListener("change", handleMediaChange);
    } else if (orientationMql.addListener) {
      orientationMql.addListener(handleMediaChange);
    }
    
    window.addEventListener("resize", scheduleUpdate);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleUpdate);
    }
    
    return () => {
      resizeObserver.disconnect();
      
      if (orientationMql.removeEventListener) {
        orientationMql.removeEventListener("change", handleMediaChange);
      } else if (orientationMql.removeListener) {
        orientationMql.removeListener(handleMediaChange);
      }
      
      window.removeEventListener("resize", scheduleUpdate);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", scheduleUpdate);
      }
    };
  }, []);

  return orientation;
}
