import { useRef, useEffect } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

type Trace = { x?: number[]; y?: (number | null)[]; type?: string; mode?: string; line?: { color?: string; width?: number }; connectgaps?: boolean };

const Plot = ({ data, layout, style, ..._props }: { data: Trace[]; layout?: any; style?: React.CSSProperties;[k: string]: any }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const upRef = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const trace = data?.[0] ?? { x: [], y: [] };
    const x = trace.x ?? [];
    let y = trace.y ?? [];
    if (trace.connectgaps) {
      // simple forward-fill to connect gaps
      let prev: number | null = null;
      y = y.map(v => {
        if (v == null || !Number.isFinite(+v)) return prev;
        prev = +v;
        return +v;
      });
    }

    const color = trace.line?.color ?? '#1f77b4';
    const width = trace.line?.width ?? 2;

    const options: uPlot.Options = {
      width: el.clientWidth || 600,
      height: el.clientHeight || 360,
      scales: {
        x: { time: false }
      },
      axes: [
        { label: layout?.xaxis?.title?.text ?? 'X' },
        { label: layout?.yaxis?.title?.text ?? 'Y' }
      ],
      series: [
        {},
        { stroke: color, width }
      ]
    };

    const u = new uPlot(options, [x, y], el);
    upRef.current = u;

    // set ranges if provided
    try {
      if (layout?.xaxis?.range) u.setScale('x', { min: layout.xaxis.range[0], max: layout.xaxis.range[1] });
      if (layout?.yaxis?.range) u.setScale('y', { min: layout.yaxis.range[0], max: layout.yaxis.range[1] });
    } catch (e) {
      // ignore if setScale is unavailable
    }

    let ro: ResizeObserver | null = null;
    const resizeHandler = () => {
      if (!upRef.current || !ref.current) return;
      const w = ref.current.clientWidth;
      const h = ref.current.clientHeight;
      upRef.current.setSize({ width: w, height: h });
    };

    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(resizeHandler);
      ro.observe(el);
    } else {
      window.addEventListener('resize', resizeHandler);
    }

    void _props;

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resizeHandler);
      u.destroy();
      upRef.current = null;
    };
  }, [data, layout]);

  useEffect(() => {
    if (!upRef.current) return;
    const trace = data?.[0];
    const x = trace?.x ?? [];
    const y = trace?.y ?? [];
    upRef.current.setData([x, y]);
  }, [data]);

  return <div className="w-full h-full" style={style} ref={ref} />;
};

export default Plot;
