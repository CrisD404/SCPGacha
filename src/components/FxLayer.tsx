import { useEffect, useRef } from 'react';
import { fx } from '../fx/particles';

export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    fx.attach(ref.current);
    const onResize = () => fx.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      fx.detach();
    };
  }, []);
  return <canvas ref={ref} className="fx-layer" aria-hidden="true" />;
}
